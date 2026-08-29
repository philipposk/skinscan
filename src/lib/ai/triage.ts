import {
  BAND_ORDER,
  CHANGE_THRESHOLDS,
  RED_FLAGS,
  RISK_BANDS,
  SEVEN_POINT,
  maxBand,
  type RiskBand,
  type RiskContext,
} from "@/lib/clinical";
import { availableModels, FALLBACKS, modelSetId } from "./models";
import { callVision, extractJson, type ModelSpec } from "./providers";
import { compareSystem, comparePrompt, observerPrompt, observerSystem, type ObservationContext } from "./prompts";

export interface ModelVote {
  model: string;
  label: string;
  ok: boolean;
  ms: number;
  error?: string;
  concern?: number;
  sevenPointScore?: number;
  photoQuality?: string;
  observation?: Record<string, unknown>;
}

export interface TriageResult {
  riskBand: RiskBand;
  agreement: number | null;
  redFlags: string[];
  recommendation: string;
  rationale: string;
  features: Record<string, unknown>;
  votes: ModelVote[];
  modelSet: string;
  durationMs: number;
  usableImage: boolean;
}

function sevenPointScore(obs: Record<string, unknown>): number {
  const sp = (obs.seven_point ?? {}) as Record<string, boolean | null>;
  let score = 0;
  for (const f of SEVEN_POINT.major) if (sp[f.key] === true) score += f.weight;
  for (const f of SEVEN_POINT.minor) if (sp[f.key] === true) score += f.weight;
  return score;
}

/**
 * Maps observations onto a band using the NICE 7-point threshold as the spine.
 * The model's own "concern" number is deliberately given less weight than the
 * checklist, because the checklist is auditable and the number is not.
 */
function bandFromObservation(obs: Record<string, unknown>): RiskBand {
  const score = sevenPointScore(obs);
  const concern = typeof obs.overall_concern === "number" ? obs.overall_concern : 0;

  let band: RiskBand;
  if (score >= 5) band = "see_doctor_soon";
  else if (score >= SEVEN_POINT.referralThreshold) band = "get_checked";
  else if (score >= 1) band = "monitor";
  else band = "reassuring";

  // A model that is strongly concerned can push the band up one step, but can
  // never push it down. Asymmetric on purpose.
  if (concern >= 0.75) band = maxBand(band, "get_checked");
  else if (concern >= 0.5) band = maxBand(band, "monitor");

  if (obs.stands_out_from_neighbours === true) band = maxBand(band, "get_checked");

  return band;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function runModel(
  spec: ModelSpec,
  system: string,
  prompt: string,
  images: { base64: string; mime: string }[],
): Promise<ModelVote> {
  const started = Date.now();
  const attempt = async (s: ModelSpec) => {
    const raw = await callVision(s, { system, prompt, images });
    return extractJson(raw) as Record<string, unknown>;
  };

  try {
    const observation = await attempt(spec);
    return {
      model: spec.id,
      label: spec.label,
      ok: true,
      ms: Date.now() - started,
      concern: typeof observation.overall_concern === "number" ? observation.overall_concern : undefined,
      sevenPointScore: sevenPointScore(observation),
      photoQuality: typeof observation.photo_quality === "string" ? observation.photo_quality : undefined,
      observation,
    };
  } catch (primaryErr) {
    const fb = FALLBACKS[spec.id];
    if (fb) {
      try {
        const observation = await attempt(fb);
        return {
          model: fb.id,
          label: `${fb.label} (fallback)`,
          ok: true,
          ms: Date.now() - started,
          concern: typeof observation.overall_concern === "number" ? observation.overall_concern : undefined,
          sevenPointScore: sevenPointScore(observation),
          photoQuality: typeof observation.photo_quality === "string" ? observation.photo_quality : undefined,
          observation,
        };
      } catch {
        /* fall through to the error below */
      }
    }
    return {
      model: spec.id,
      label: spec.label,
      ok: false,
      ms: Date.now() - started,
      error: primaryErr instanceof Error ? primaryErr.message.slice(0, 300) : String(primaryErr),
    };
  }
}

export async function triageImage(
  image: { base64: string; mime: string },
  ctx: ObservationContext & { userReportedFlags?: string[]; riskContext?: RiskContext },
): Promise<TriageResult> {
  const started = Date.now();
  const models = availableModels();

  if (!models.length) {
    throw new Error("No vision provider is configured. Set at least GEMINI_API_KEY or OPENAI_API_KEY.");
  }

  const system = observerSystem();
  const prompt = observerPrompt(ctx);
  const votes = await Promise.all(models.map((m) => runModel(m, system, prompt, [image])));
  const good = votes.filter((v) => v.ok && v.observation);

  if (!good.length) {
    throw new Error(
      `Every model failed. First error: ${votes[0]?.error ?? "unknown"}`,
    );
  }

  // Photo quality. If most models say the photo is poor, we refuse to produce a
  // band at all rather than assessing a picture we cannot see.
  const poor = good.filter((v) => v.photoQuality === "poor").length;
  const usableImage = poor < Math.ceil(good.length / 2);

  const bands = good.map((v) => bandFromObservation(v.observation!));
  const indices = bands.map((b) => BAND_ORDER.indexOf(b));

  // Take the highest band any model reached, not the average. In a screening
  // context a false alarm costs a GP visit; a miss costs much more.
  let band = BAND_ORDER[Math.max(...indices)];

  // Agreement = 1 when every model landed on the same band, 0 when they span
  // the whole scale. This is shown to the user, not hidden.
  const spread = Math.max(...indices) - Math.min(...indices);
  const agreement = good.length > 1 ? Number((1 - spread / (BAND_ORDER.length - 1)).toFixed(3)) : null;

  // Red flags: union of what the models saw plus what the user ticked. User
  // reports win, because they know things a photo cannot show (bleeding, itch,
  // how fast it appeared).
  const seen = new Set<string>();
  for (const v of good) {
    const flags = v.observation?.visible_red_flags;
    if (Array.isArray(flags)) for (const f of flags) if (typeof f === "string") seen.add(f);
  }
  for (const f of ctx.userReportedFlags ?? []) seen.add(f);

  for (const key of seen) {
    const def = RED_FLAGS.find((r) => r.key === key);
    if (def) band = maxBand(band, def.minimumBand);
  }

  // Low agreement is itself a reason to involve a human.
  if (agreement !== null && agreement < 0.5) band = maxBand(band, "monitor");

  const diameters = good
    .map((v) => v.observation?.diameter_mm)
    .filter((d): d is number => typeof d === "number" && d > 0);

  const colourCounts = good
    .map((v) => v.observation?.colour_count)
    .filter((c): c is number => typeof c === "number");

  const features: Record<string, unknown> = {
    diameter_mm: median(diameters),
    colour_count: median(colourCounts),
    seven_point_score: median(good.map((v) => v.sevenPointScore ?? 0)),
    concern: median(good.map((v) => v.concern ?? 0)),
    descriptions: good.map((v) => v.observation?.description_for_clinician).filter(Boolean),
    colours: Array.from(
      new Set(good.flatMap((v) => (Array.isArray(v.observation?.colours) ? (v.observation!.colours as string[]) : []))),
    ),
    image_problems: Array.from(
      new Set(
        good.flatMap((v) =>
          Array.isArray(v.observation?.image_problems) ? (v.observation!.image_problems as string[]) : [],
        ),
      ),
    ),
  };

  const flagLabels = Array.from(seen)
    .map((k) => RED_FLAGS.find((r) => r.key === k)?.label)
    .filter((l): l is string => !!l);

  const rationale = buildRationale(band, features, agreement, flagLabels, good.length, usableImage);

  return {
    riskBand: band,
    agreement,
    redFlags: Array.from(seen),
    recommendation: RISK_BANDS[band].blurb,
    rationale,
    features,
    votes,
    modelSet: modelSetId(models),
    durationMs: Date.now() - started,
    usableImage,
  };
}

function buildRationale(
  band: RiskBand,
  features: Record<string, unknown>,
  agreement: number | null,
  flagLabels: string[],
  modelCount: number,
  usableImage: boolean,
): string {
  const bits: string[] = [];

  if (!usableImage) {
    bits.push(
      "The photo is not clear enough to judge properly. Retake it in daylight, hold steady about 15cm away, and put a coin next to the spot for scale.",
    );
  }

  const score = features.seven_point_score;
  if (typeof score === "number") {
    bits.push(
      `On the 7-point checklist used by the NHS for referrals, this scored ${score} out of 10 (3 or more is the referral threshold).`,
    );
  }

  const d = features.diameter_mm;
  if (typeof d === "number") bits.push(`Estimated width about ${d.toFixed(1)}mm.`);
  else bits.push("Width could not be measured — there was no size reference in the photo.");

  const colours = features.colours;
  if (Array.isArray(colours) && colours.length > 1) {
    bits.push(`More than one colour was described: ${colours.slice(0, 4).join(", ")}.`);
  }

  if (flagLabels.length) bits.push(`Flagged: ${flagLabels.join("; ")}.`);

  if (agreement === null) {
    bits.push(`Only one model was available, so there is no cross-check on this result.`);
  } else if (agreement < 0.5) {
    bits.push(
      `The ${modelCount} models disagreed with each other about this one. That on its own is a reason to have a person look at it.`,
    );
  } else if (agreement < 1) {
    bits.push(`${modelCount} models mostly agreed.`);
  } else {
    bits.push(`All ${modelCount} models agreed.`);
  }

  return bits.join(" ");
}

export interface CompareResult {
  comparable: boolean;
  incomparableReason: string | null;
  significant: boolean;
  diameterDeltaMm: number | null;
  areaDeltaPct: number | null;
  newColours: string[];
  borderChange: string | null;
  surfaceChange: string | null;
  summary: string;
  votes: ModelVote[];
  bandBump: RiskBand | null;
}

export async function compareImages(
  baseline: { base64: string; mime: string; scaleRef?: string | null },
  latest: { base64: string; mime: string; scaleRef?: string | null },
  daysBetween: number,
): Promise<CompareResult> {
  const models = availableModels();
  if (!models.length) throw new Error("No vision provider configured.");

  const bothScaled = baseline.scaleRef && baseline.scaleRef !== "none" && latest.scaleRef && latest.scaleRef !== "none";
  const scaleNote = bothScaled
    ? "Both photos contain a size reference object, so millimetre estimates are meaningful."
    : "At least one photo has no size reference. Do NOT give a millimetre figure; describe relative change only and set diameter_delta_mm to null.";

  const votes = await Promise.all(
    models
      .slice(0, 3)
      .map((m) =>
        runModel(m, compareSystem(), comparePrompt(daysBetween, scaleNote), [
          { base64: baseline.base64, mime: baseline.mime },
          { base64: latest.base64, mime: latest.mime },
        ]),
      ),
  );

  const good = votes.filter((v) => v.ok && v.observation);
  if (!good.length) throw new Error(`Comparison failed: ${votes[0]?.error ?? "unknown"}`);

  const obs = good.map((v) => v.observation!);
  const comparableVotes = obs.filter((o) => o.comparable === true).length;
  const comparable = comparableVotes > obs.length / 2;

  // Too close together in time to mean anything.
  if (daysBetween < CHANGE_THRESHOLDS.minDaysForComparison) {
    return {
      comparable: false,
      incomparableReason: `These photos are only ${daysBetween} days apart. Real change in a mole takes longer than that to show up — anything different here is almost certainly lighting or angle.`,
      significant: false,
      diameterDeltaMm: null,
      areaDeltaPct: null,
      newColours: [],
      borderChange: null,
      surfaceChange: null,
      summary: "Too soon to compare.",
      votes,
      bandBump: null,
    };
  }

  const deltas = obs.map((o) => o.diameter_delta_mm).filter((x): x is number => typeof x === "number");
  const areas = obs.map((o) => o.area_change_pct).filter((x): x is number => typeof x === "number");
  const newColours = Array.from(
    new Set(obs.flatMap((o) => (Array.isArray(o.new_colours) ? (o.new_colours as string[]) : []))),
  );

  const diameterDeltaMm = bothScaled ? median(deltas) : null;
  const areaDeltaPct = median(areas);

  // Majority rule on "did it change", then re-check against our own thresholds
  // so a chatty model cannot declare a 0.2mm difference significant.
  const modelsSaySignificant = obs.filter((o) => o.significant_change === true).length > obs.length / 2;

  const passesThreshold =
    (diameterDeltaMm !== null && Math.abs(diameterDeltaMm) >= CHANGE_THRESHOLDS.minDiameterDeltaMm) ||
    (areaDeltaPct !== null && areaDeltaPct >= CHANGE_THRESHOLDS.significantAreaGrowthPct) ||
    (CHANGE_THRESHOLDS.newColourIsSignificant && newColours.length > 0) ||
    obs.some((o) => o.surface_change === "newly ulcerated" || o.surface_change === "newly crusted");

  const significant = comparable && modelsSaySignificant && passesThreshold;

  const first = obs.find((o) => typeof o.summary === "string");

  return {
    comparable,
    incomparableReason: comparable
      ? null
      : (obs.find((o) => typeof o.incomparable_reason === "string")?.incomparable_reason as string) ??
        "The two photos are too different in lighting or framing to compare fairly.",
    significant,
    diameterDeltaMm,
    areaDeltaPct,
    newColours,
    borderChange: (obs.find((o) => o.border_change && o.border_change !== "none")?.border_change as string) ?? null,
    surfaceChange: (obs.find((o) => o.surface_change && o.surface_change !== "none")?.surface_change as string) ?? null,
    summary: (first?.summary as string) ?? "No summary available.",
    votes,
    // Documented change is the single strongest thing a self-monitoring app can
    // detect, so it escalates on its own.
    bandBump: significant ? "get_checked" : null,
  };
}
