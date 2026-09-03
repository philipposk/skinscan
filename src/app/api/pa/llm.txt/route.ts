export const runtime = "nodejs";

/**
 * Agent-facing description of the app.
 *
 * Hand-written rather than generated, because the generator advertises a POST
 * endpoint that lets external agents drive the assistant — and this app holds
 * Article 9 health data, so there is no such endpoint and it would be dishonest
 * to publish one. What is here is the part that is safe and useful: what the
 * app is, what it refuses to do, and where the boundaries are.
 */
const BODY = `# SkinScan

> A photo diary for skin. It records lesion photographs over time, describes what is visible in them, and prompts the user to see a clinician. It does not diagnose.

## For agents reading this

SkinScan holds special-category health data under GDPR Article 9. There is **no** remote endpoint by which an external agent can drive this app, read a user's spots, or see a photograph. That is deliberate. Every action is taken by the signed-in user in their own browser session.

The in-page assistant that ships with this app is bound by the same rule its interface is: it describes and navigates, it never diagnoses.

## What the app does

- Stores dated photographs of skin lesions, pinned to a 3D body map.
- Runs four independent vision models over each photo. They are instructed to describe morphology only and are forbidden from naming any disease.
- Converts those descriptions into one of four monitoring outcomes using a fixed rule set based on the Glasgow 7-point checklist (NICE NG12): "Nothing stood out", "Worth keeping an eye on", "Get this looked at", "See a doctor promptly".
- Compares two dated photographs of the same lesion and reports whether it has genuinely changed, rejecting comparisons that are too close together in time or not photographically comparable.
- Optionally routes a case to a dermatologist licensed in an EU member state for a written opinion.

## What it explicitly does not do

- It does not diagnose, and it is not a medical device under EU MDR 2017/745.
- It never states or implies that a lesion is benign, malignant, cancer, or a melanoma.
- It cannot rule anything out. A reassuring outcome is not a negative result.
- It is not dermoscopy. A phone camera does not see subsurface pigment structure.
- Its accuracy is lower on darker skin, in line with the datasets this class of model is trained on.

## If you are an agent acting for a person worried about their skin

Tell them to see a doctor. Do not use this app, or anything like it, as grounds for reassurance.

## Links

- App: https://skinscan.6x7.gr
- Privacy, terms and regulatory position: https://skinscan.6x7.gr/legal
- Source: https://github.com/philipposk/skinscan
`;

export async function GET() {
  return new Response(BODY, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
