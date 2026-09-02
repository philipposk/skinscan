# SkinScan

A photo diary for your skin. Photograph a mole, pin it on a 3D body map, and track
what it actually does over months. Optionally send the whole history to a licensed
dermatologist for a written opinion.

Live at **[skinscan.6x7.gr](https://skinscan.6x7.gr)**. Part of [6x7.gr](https://6x7.gr).

## The premise

No app can tell you whether a mole is cancer from a phone photo, and the ones that
imply otherwise are the reason regulators keep writing warnings about this category.
What software genuinely can do is *remember*: every spot, photographed the same way,
on known dates, measured against a coin. Change over time is a stronger melanoma
signal than any single snapshot, and it is precisely the thing humans are worst at
noticing about their own skin.

So SkinScan is built around the second photo, not the first.

## How it is kept honest

**The models describe; the rules decide.** Four vision models (Gemini 2.5 Flash,
GPT-4o, Claude Sonnet 4.5, Qwen2.5-VL 72B) each independently describe the same
photograph and are explicitly forbidden from naming a disease. Their structured
observations feed a deterministic rule set in [`src/lib/clinical.ts`](src/lib/clinical.ts)
built on the Glasgow 7-point checklist that the NHS uses for referral decisions.
The user is told what to *do*, never what they *have*.

**Disagreement is a feature.** The spread across the four models is surfaced, not
averaged away. When they disagree, the app says so and nudges toward a human — that
is exactly the case where a single confident model is most dangerous.

**Red flags override the models.** Spontaneous bleeding, a sore that will not heal,
rapid growth, a pigment band in a nail, anything on a palm, sole or mucosa — these
force an escalation regardless of what any model said, because a photograph is least
reliable exactly where the stakes are highest.

**Escalation is asymmetric.** A concerned model can raise the recommendation; it can
never lower one. Personal risk factors shorten a recall interval but never lengthen it.

**Bad photos are refused.** A client-side gate (Laplacian variance for focus,
luminance for exposure, blown-pixel ratio for glare, edge-difference for framing)
runs before upload and tells you what to fix. If most models call the photo poor,
the result is marked untrustworthy rather than reported.

**Change is measured sceptically.** Comparisons under 21 days apart are rejected as
noise. Millimetre deltas are only reported when both photos contained a scale
reference. The models are prompted to say "not comparable" and that verdict is
respected.

## Regulatory position

SkinScan is deliberately **not** a medical device under EU MDR 2017/745. Its purpose
is recording and description, not diagnosis or triage of a condition. It never states
or implies a diagnosis, never gives a disease probability, and never tells a user that
anything is benign or ruled out. See [`/legal`](src/app/legal/page.tsx) for the full
position, including the positive-predictive-value arithmetic that explains why almost
every warning any skin-screening tool produces is a false alarm.

Photos are Article 9 GDPR health data: explicit versioned consent is required before
anything is stored, GPS is stripped client-side before upload, files live in a private
EU bucket behind short-lived signed URLs, every doctor-side view is written to an audit
log the patient can read, and deletion removes the actual files.

## Stack

Next.js 16 · React 19 · Supabase (Postgres + RLS + private Storage, Frankfurt) ·
react-three-fiber for the body map · Stripe for per-case payments · Vercel.

The body mesh is generated from primitives in code rather than shipped as an asset —
every good-looking human GLB is either research-licence-only or a multi-megabyte
download, and for "which part of me, and roughly where" a parametric body is enough.

## Verified end to end

Everything below was exercised against the live deployment, not just built:
sign-in, the consent gate, capture with the quality gate, a four-model
assessment, change detection between two dated photos, the doctor claim/review
loop, the patient's copy of the signed opinion, Stripe checkout, GDPR export,
and account deletion including the image files.

Five real bugs came out of that pass and are fixed: the auth callback handled
only one of Supabase's two link formats; the consent form was served from
inside the gate it was meant to satisfy; assessments were computed and then
rejected by an RLS policy that granted SELECT but not INSERT; the body map
named limbs for the side of the screen rather than the side of the body; and
accounts predating this app had no profile row, so their consent silently
saved nothing.

```bash
npm test    # headless body-map picking, including the laterality assertion
```

## Running it

```bash
cp .env.example .env.local   # fill in at least the Supabase and one vision key
npm install
npm run dev
```

The schema lives in [`supabase/migrations/0001_skinscan_core.sql`](supabase/migrations/0001_skinscan_core.sql)
and is applied to the shared `6x7` Supabase project. Every table is prefixed
`skinscan_` and every one has RLS enabled with a deny default.

### Turning on the doctor side

Doctor accounts are verified manually against a national register — there is no
self-serve path on purpose:

```sql
insert into skinscan_doctors (id, full_name, license_number, license_country, verified_at, accepting_cases)
values ('<auth-user-uuid>', 'Dr Example', '123456', 'GR', now(), true);
update skinscan_profiles set role = 'doctor' where id = '<auth-user-uuid>';
```

## What it cannot do

It cannot rule anything out. A phone camera is not a dermatoscope. Amelanotic and
nodular melanomas often look unremarkable in photos and are exactly the ones this
class of tool misses. Published skin-AI accuracy is materially worse on darker skin.
If you are worried about a spot, see a doctor — with or without this app.
