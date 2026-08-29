import { ABCDE, SEVEN_POINT, RED_FLAGS } from "@/lib/clinical";

/**
 * The models are asked to *observe*, not to *diagnose*.
 *
 * This is not a legal fig leaf, it is what makes the output useful. A model that
 * returns "probably benign, 87%" gives a user nothing to check and nothing to
 * show a doctor. A model that returns "two shades of brown, notched border at
 * the 4 o'clock edge, 5.5mm across" produces observations a dermatologist can
 * agree or disagree with, and it feeds a rule set we control.
 */

const OBSERVER_SYSTEM = `You are a careful dermatology image describer working inside a skin self-monitoring app. You are NOT a diagnostician and you must never name a disease, never say "melanoma", "benign", "malignant", "cancer", or give a probability of any disease.

Your entire job is to describe what is visible in the photograph, precisely and conservatively, using the structured fields you are given. A dermatologist and a deterministic rule engine downstream will decide what it means.

Rules you must follow:
- Describe only what you can actually see. If the photo is blurry, badly lit, too far away, or the lesion is obscured by hair or clothing, say so in "image_problems" and mark the affected observations as null rather than guessing.
- You are looking at an ordinary phone photo, not a dermoscopic image. Do not claim to see pigment networks, globules, or vascular structures unless the image is clearly a dermoscopy image.
- Never inflate confidence. "uncertain" is a correct and useful answer.
- Size: estimate the lesion's largest diameter in millimetres ONLY if a scale reference is described to you. Otherwise return null for diameter_mm and explain in "image_problems".
- Return ONLY a single JSON object. No prose, no markdown fence.`;

export function observerSystem() {
  return OBSERVER_SYSTEM;
}

export interface ObservationContext {
  bodySite?: string | null;
  scaleRef?: string | null;
  mmPerPx?: number | null;
  userNotes?: string | null;
  fitzpatrick?: number | null;
}

const SCALE_HINTS: Record<string, string> = {
  coin_1euro: "A 1 euro coin (23.25 mm across) is in frame as a size reference.",
  coin_2euro: "A 2 euro coin (25.75 mm across) is in frame as a size reference.",
  sticker_10mm: "A printed 10 mm circular sticker is in frame as a size reference.",
  ruler: "A ruler with millimetre markings is in frame.",
  dermoscope: "This image was taken through a dermatoscope attachment, so subsurface pigment structures may genuinely be visible.",
  none: "No size reference is in frame, so absolute size cannot be measured from this photo.",
};

export function observerPrompt(ctx: ObservationContext): string {
  const lines: string[] = [];
  lines.push("Describe the single skin lesion that is the subject of this photograph.");
  lines.push("");
  if (ctx.bodySite) lines.push(`Body site reported by the user: ${ctx.bodySite}.`);
  lines.push(SCALE_HINTS[ctx.scaleRef ?? "none"] ?? SCALE_HINTS.none);
  if (ctx.mmPerPx) lines.push(`Calibration from the reference object: ${ctx.mmPerPx.toFixed(4)} mm per pixel.`);
  if (ctx.fitzpatrick) {
    lines.push(
      `The user reports Fitzpatrick skin type ${ctx.fitzpatrick}. Judge contrast and colour relative to THIS person's surrounding skin, not to pale skin.`,
    );
  }
  if (ctx.userNotes) lines.push(`The user wrote: ${JSON.stringify(ctx.userNotes)}. Treat this as a claim, not as fact you can see.`);
  lines.push("");
  lines.push("Return exactly this JSON shape:");
  lines.push(`{
  "lesion_present": boolean,
  "image_problems": string[],
  "abcde": {
${ABCDE.map(
  (a) =>
    `    "${a.key}": { "present": true|false|null, "confidence": 0.0-1.0, "note": "what you actually see, one short sentence" }`,
).join(",\n")}
  },
  "diameter_mm": number|null,
  "colours": string[],
  "colour_count": number,
  "border": "smooth"|"slightly irregular"|"notched or ragged"|"unclear",
  "surface": "flat"|"raised"|"dome shaped"|"crusted"|"ulcerated"|"scaly"|"unclear",
  "symmetry": "symmetric"|"mildly asymmetric"|"clearly asymmetric"|"unclear",
  "seven_point": {
${[...SEVEN_POINT.major, ...SEVEN_POINT.minor]
  .map((f) => `    "${f.key}": true|false|null`)
  .join(",\n")}
  },
  "visible_red_flags": [${RED_FLAGS.map((r) => `"${r.key}"`).join(", ")}],
  "stands_out_from_neighbours": true|false|null,
  "photo_quality": "good"|"usable"|"poor",
  "description_for_clinician": "3-4 factual sentences a dermatologist could read",
  "overall_concern": 0.0-1.0
}`);
  lines.push("");
  lines.push(
    '"overall_concern" is how strongly the VISIBLE FEATURES resemble the features clinicians are taught to take seriously. It is not a probability of disease and it must never be described as one. Only report red flags in "visible_red_flags" that you can literally see in the image; things the user told you go in the description instead.',
  );
  return lines.join("\n");
}

const COMPARE_SYSTEM = `You compare two photographs of the SAME skin lesion taken on different dates, for a self-monitoring app. You are not a diagnostician and must never name a disease.

Your only job is to report whether the lesion has genuinely changed, and to separate real change from photographic artefact. Different lighting, distance, angle, camera and skin tone rendering routinely make a lesion look different when it is not. Be sceptical: say "not comparable" when the two photos are too different to judge.

Return ONLY a single JSON object.`;

export function compareSystem() {
  return COMPARE_SYSTEM;
}

export function comparePrompt(daysBetween: number, scaleNote: string): string {
  return `The first image is the BASELINE, taken ${daysBetween} days before the second image.

${scaleNote}

Return exactly this JSON shape:
{
  "comparable": boolean,
  "incomparable_reason": string|null,
  "size_change": "smaller"|"no visible change"|"slightly larger"|"clearly larger"|"cannot tell",
  "diameter_delta_mm": number|null,
  "area_change_pct": number|null,
  "new_colours": string[],
  "lost_colours": string[],
  "border_change": "none"|"more irregular"|"less irregular"|"cannot tell",
  "surface_change": "none"|"newly raised"|"newly crusted"|"newly ulcerated"|"cannot tell",
  "asymmetry_change": "none"|"more asymmetric"|"less asymmetric"|"cannot tell",
  "artefact_warnings": string[],
  "significant_change": boolean,
  "summary": "2-3 plain sentences describing what differs between the two photos"
}

Set "significant_change" true only for a change you would still call real after accounting for lighting, angle and distance differences. If the two photos are not comparable, "significant_change" must be false and "comparable" must be false.`;
}
