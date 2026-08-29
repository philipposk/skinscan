import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { triageImage } from "@/lib/ai/triage";
import { recallDaysFor } from "@/lib/clinical";

export const runtime = "nodejs";
export const maxDuration = 120;

async function fetchAsBase64(admin: ReturnType<typeof createAdminClient>, path: string) {
  const { data, error } = await admin.storage.from("skinscan").download(path);
  if (error || !data) throw new Error(error?.message ?? "Could not read the image");
  const buf = Buffer.from(await data.arrayBuffer());
  return { base64: buf.toString("base64"), mime: data.type || "image/jpeg" };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b?.image_id) return NextResponse.json({ error: "Missing image_id" }, { status: 400 });

  // RLS scopes this select to the caller, so a foreign image simply is not found.
  const { data: image } = await supabase
    .from("skinscan_images")
    .select("id, lesion_id, storage_path, scale_ref, mm_per_px")
    .eq("id", b.image_id)
    .maybeSingle();
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: lesion } = await supabase
    .from("skinscan_lesions")
    .select("body_site, notes")
    .eq("id", image.lesion_id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("skinscan_profiles")
    .select(
      "fitzpatrick, year_of_birth, personal_history_skin_cancer, family_history_melanoma, immunosuppressed, many_moles",
    )
    .eq("id", user.id)
    .maybeSingle();

  const admin = createAdminClient();

  try {
    const img = await fetchAsBase64(admin, image.storage_path);

    const result = await triageImage(img, {
      bodySite: lesion?.body_site ?? null,
      scaleRef: image.scale_ref,
      mmPerPx: image.mm_per_px,
      userNotes: lesion?.notes ?? null,
      fitzpatrick: profile?.fitzpatrick ?? null,
      userReportedFlags: Array.isArray(b.red_flags) ? b.red_flags.map(String) : [],
      riskContext: {
        personalHistorySkinCancer: profile?.personal_history_skin_cancer,
        familyHistoryMelanoma: profile?.family_history_melanoma,
        immunosuppressed: profile?.immunosuppressed,
        manyMoles: profile?.many_moles,
      },
    });

    const { data: saved, error } = await supabase
      .from("skinscan_assessments")
      .insert({
        image_id: image.id,
        lesion_id: image.lesion_id,
        user_id: user.id,
        features: result.features,
        model_votes: result.votes.map((v) => ({
          model: v.model,
          label: v.label,
          ok: v.ok,
          ms: v.ms,
          error: v.error ?? null,
          concern: v.concern ?? null,
          seven_point: v.sevenPointScore ?? null,
          photo_quality: v.photoQuality ?? null,
        })),
        risk_band: result.riskBand,
        agreement: result.agreement,
        red_flags: result.redFlags,
        recommendation: result.recommendation,
        rationale: result.rationale,
        model_set: result.modelSet,
        duration_ms: result.durationMs,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // The trigger already set a default recall date from the band; personal risk
    // factors can only pull it closer, never push it out.
    const days = recallDaysFor(result.riskBand, {
      personalHistorySkinCancer: profile?.personal_history_skin_cancer,
      familyHistoryMelanoma: profile?.family_history_melanoma,
      immunosuppressed: profile?.immunosuppressed,
      manyMoles: profile?.many_moles,
    });
    const due = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    await supabase.from("skinscan_lesions").update({ next_review_due: due }).eq("id", image.lesion_id);
    await supabase
      .from("skinscan_reminders")
      .insert({ user_id: user.id, lesion_id: image.lesion_id, kind: "rephotograph", due_on: due });

    if (typeof b.diameter_mm === "number") {
      await supabase.from("skinscan_images").update({ lesion_diameter_mm: b.diameter_mm }).eq("id", image.id);
    } else if (typeof result.features.diameter_mm === "number") {
      await supabase
        .from("skinscan_images")
        .update({ lesion_diameter_mm: result.features.diameter_mm })
        .eq("id", image.id);
    }

    return NextResponse.json({ id: saved.id, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Assessment failed" },
      { status: 502 },
    );
  }
}
