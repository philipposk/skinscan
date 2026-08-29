/**
 * The clinical rulebook.
 *
 * Everything in this file is deterministic and human-auditable on purpose. The
 * language models are only allowed to *describe* a lesion; the decision about
 * what the user should do is made here, by rules that map onto published
 * dermatology guidance. That split matters for two reasons:
 *
 *  - Safety. A model that is confidently wrong cannot talk the app out of
 *    telling someone to see a doctor, because red flags are hard-coded and
 *    override the model.
 *  - Regulation. The output is a *recall interval and a referral prompt*, the
 *    same thing a triage leaflet gives you. It is never a diagnosis.
 *
 * Sources for the rules, so a clinician can check them:
 *  - NICE NG12, "Suspected cancer: recognition and referral" — the Glasgow
 *    7-point checklist and the 2-week-wait threshold.
 *  - ABCDE criteria, as popularised by the American Academy of Dermatology.
 *  - Grob & Bonerandi, "ugly duckling" sign.
 */

export type RiskBand = "reassuring" | "monitor" | "get_checked" | "see_doctor_soon";

export const RISK_BANDS: Record<
  RiskBand,
  { label: string; blurb: string; recallDays: number; tone: string }
> = {
  reassuring: {
    label: "Nothing stood out",
    blurb:
      "Nothing in this photo matched the features we look for. That is not the same as “this is harmless” — photos miss things. Keep it in your log and re-photograph it in about six months.",
    recallDays: 180,
    tone: "green",
  },
  monitor: {
    label: "Worth keeping an eye on",
    blurb:
      "One or two features are worth watching. The useful thing now is a second photo in about three months — change over time tells you far more than any single picture.",
    recallDays: 90,
    tone: "amber",
  },
  get_checked: {
    label: "Get this looked at",
    blurb:
      "Several features here are the kind a dermatologist should look at in person. Book an appointment in the next couple of weeks. This is not a diagnosis and most spots like this turn out to be harmless.",
    recallDays: 14,
    tone: "orange",
  },
  see_doctor_soon: {
    label: "See a doctor promptly",
    blurb:
      "This has features that should be examined soon — within days, not months. Please book with a dermatologist or your GP. Again: this is a prompt to get checked, not a diagnosis.",
    recallDays: 3,
    tone: "red",
  },
};

/**
 * Glasgow 7-point checklist (NICE NG12). Major features score 2, minor score 1.
 * A total of 3 or more is the NHS threshold for an urgent referral. We use the
 * same threshold rather than inventing our own.
 */
export const SEVEN_POINT = {
  major: [
    { key: "change_in_size", label: "Change in size", weight: 2 },
    { key: "irregular_shape", label: "Irregular shape or border", weight: 2 },
    { key: "irregular_colour", label: "Irregular colour", weight: 2 },
  ],
  minor: [
    { key: "largest_diameter_7mm", label: "Largest diameter 7mm or more", weight: 1 },
    { key: "inflammation", label: "Inflammation", weight: 1 },
    { key: "oozing", label: "Oozing or crusting", weight: 1 },
    { key: "change_in_sensation", label: "Change in sensation, including itch", weight: 1 },
  ],
  referralThreshold: 3,
} as const;

export type SevenPointKey =
  | (typeof SEVEN_POINT.major)[number]["key"]
  | (typeof SEVEN_POINT.minor)[number]["key"];

export const ABCDE = [
  {
    key: "asymmetry",
    letter: "A",
    label: "Asymmetry",
    plain: "One half does not match the other half.",
  },
  {
    key: "border",
    letter: "B",
    label: "Border",
    plain: "Edges are ragged, notched, blurred, or scalloped rather than a clean circle.",
  },
  {
    key: "colour",
    letter: "C",
    label: "Colour",
    plain: "More than one colour, or an uneven mix — brown, black, tan, red, white, blue.",
  },
  {
    key: "diameter",
    letter: "D",
    label: "Diameter",
    plain: "Wider than about 6mm (a pencil eraser). Smaller spots can still matter.",
  },
  {
    key: "evolving",
    letter: "E",
    label: "Evolving",
    plain: "It is changing — in size, shape, colour, or how it feels.",
  },
] as const;

/**
 * Hard red flags. If any of these is present, the band is forced to at least
 * `get_checked` no matter what the models said, and the copy tells the user to
 * book. These are the presentations where a photograph is least reliable and
 * the cost of a miss is highest.
 */
export const RED_FLAGS: {
  key: string;
  label: string;
  why: string;
  minimumBand: RiskBand;
}[] = [
  {
    key: "bleeding_without_injury",
    label: "Bleeding on its own, without being knocked or scratched",
    why: "Spontaneous bleeding from a pigmented lesion is a classic warning sign and needs an in-person look.",
    minimumBand: "see_doctor_soon",
  },
  {
    key: "non_healing_sore",
    label: "A sore that has not healed in four weeks or more",
    why: "Non-healing lesions are how most basal and squamous cell cancers present.",
    minimumBand: "see_doctor_soon",
  },
  {
    key: "rapid_growth",
    label: "Grew noticeably within a few weeks",
    why: "Fast growth is one of the few features that distinguishes aggressive nodular melanoma, which the ABCDE rules miss.",
    minimumBand: "see_doctor_soon",
  },
  {
    key: "nail_pigment_band",
    label: "A new dark stripe down a nail, or pigment spreading onto the skin around the nail",
    why: "A pigment band that spreads onto the nail fold can indicate subungual melanoma. Photographs are unreliable here.",
    minimumBand: "see_doctor_soon",
  },
  {
    key: "palm_sole_mucosa",
    label: "On a palm, a sole, under a nail, or on the lips, mouth or genitals",
    why: "Melanoma at these sites behaves differently and is easy to dismiss. It should be examined in person regardless of how it looks in a photo.",
    minimumBand: "get_checked",
  },
  {
    key: "ulceration",
    label: "Broken skin, an open crater, or crusting over the spot",
    why: "Ulceration is a marker of a more advanced lesion.",
    minimumBand: "see_doctor_soon",
  },
  {
    key: "ugly_duckling",
    label: "Looks clearly unlike all your other moles",
    why: "The ugly duckling sign catches melanomas that individually look unremarkable but stand out from a person's own pattern.",
    minimumBand: "get_checked",
  },
  {
    key: "new_after_40",
    label: "A brand new mole that appeared after about age 40",
    why: "Most ordinary moles appear before 40. New pigmented lesions later in life deserve a check.",
    minimumBand: "monitor",
  },
];

export const BAND_ORDER: RiskBand[] = [
  "reassuring",
  "monitor",
  "get_checked",
  "see_doctor_soon",
];

export function maxBand(a: RiskBand, b: RiskBand): RiskBand {
  return BAND_ORDER.indexOf(a) >= BAND_ORDER.indexOf(b) ? a : b;
}

/**
 * Personal risk multipliers. These do not change what the lesion looks like, so
 * they never raise the band on their own. They shorten the recall interval and
 * are shown to a reviewing doctor as context.
 */
export interface RiskContext {
  personalHistorySkinCancer?: boolean;
  familyHistoryMelanoma?: boolean;
  immunosuppressed?: boolean;
  manyMoles?: boolean;
  fitzpatrick?: number | null;
  yearOfBirth?: number | null;
}

export function recallDaysFor(band: RiskBand, ctx: RiskContext = {}): number {
  const base = RISK_BANDS[band].recallDays;
  let factor = 1;
  if (ctx.personalHistorySkinCancer) factor *= 0.5;
  if (ctx.immunosuppressed) factor *= 0.5;
  if (ctx.familyHistoryMelanoma) factor *= 0.75;
  if (ctx.manyMoles) factor *= 0.75;
  // Never stretch an interval, only shorten it, and never below three days.
  return Math.max(3, Math.round(base * Math.min(1, factor)));
}

/**
 * Change thresholds for sequential imaging.
 *
 * Serial digital dermoscopy works on a simple principle: benign moles are
 * stable over months, melanoma is not. These thresholds are what we treat as a
 * meaningful change rather than photographic noise. They are deliberately
 * conservative — a false "it changed" costs the user a doctor's visit, a missed
 * change costs much more.
 */
export const CHANGE_THRESHOLDS = {
  /** Below this the difference is within measurement error of a phone camera. */
  minDiameterDeltaMm: 1.0,
  /** Relative area growth that counts as real. */
  significantAreaGrowthPct: 20,
  /** Any brand new colour in a lesion is significant regardless of size. */
  newColourIsSignificant: true,
  /** Comparisons closer together than this are usually just noise. */
  minDaysForComparison: 21,
  /** The standard short-interval follow-up for an equivocal lesion. */
  standardShortIntervalDays: 90,
  /** Routine self-surveillance interval for a stable lesion. */
  standardLongIntervalDays: 180,
} as const;

export const BODY_SITES = [
  "head/neck",
  "upper extremity",
  "lower extremity",
  "anterior torso",
  "posterior torso",
  "lateral torso",
  "palms/soles",
  "oral/genital",
  "unknown",
] as const;

export type BodySite = (typeof BODY_SITES)[number];

/**
 * What a photo genuinely cannot do. Shown verbatim in the product, because the
 * honest framing is also the legally safe framing.
 */
export const LIMITATIONS = [
  "A phone photo is not dermoscopy. A dermatologist looking through a dermatoscope sees pigment structures under the surface that no ordinary camera captures.",
  "Amelanotic (colourless) and nodular melanomas often look unremarkable in photos and are exactly the ones these tools miss.",
  "Skin cancer is rare in the general population, so even an accurate tool produces far more false alarms than real finds. Treat a warning as a reason to get checked, not as a result.",
  "Most published skin-AI performance comes from datasets that under-represent brown and black skin. Accuracy is lower on darker skin and you should weight the tool's opinion accordingly.",
  "Nothing here can rule anything out. A reassuring result never means a lesion is safe.",
];

export const EMERGENCY_COPY =
  "If a spot is bleeding heavily, growing quickly, or you feel unwell with it, do not wait for this app. Contact a doctor, or in Greece call 166 (EKAB) for emergencies.";
