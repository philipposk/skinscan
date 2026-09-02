import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { compareImages } from "@/lib/ai/triage";
import { maxBand, recallDaysFor, type RiskBand } from "@/lib/clinical";

export const runtime = "nodejs";
export const maxDuration = 120;

async function fetchAsBase64(admin: ReturnType<typeof createAdminClient>, path: string) {
  const { data, error } = await admin.storage.from("skinscan").download(path);
  if (error || !data) throw new Error(error?.message ?? "Could not read the image");
  return { base64: Buffer.from(await data.arrayBuffer()).toString("base64"), mime: data.type || "image/jpeg" };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b?.lesion_id) return NextResponse.json({ error: "Missing lesion_id" }, { status: 400 });

  const { data: images } = await supabase
    .from("skinscan_images")
    .select("id, storage_path, captured_at, scale_ref")
    .eq("lesion_id", b.lesion_id)
    .order("captured_at", { ascending: true });

  if (!images || images.length < 2) {
    return NextResponse.json(
      { error: "Two photos taken on different dates are needed before anything can be compared." },
      { status: 400 },
    );
  }

  const baseline = images[0];
  const latest = images[images.length - 1];
  const days = Math.round(
    (new Date(latest.captured_at).getTime() - new Date(baseline.captured_at).getTime()) / 86_400_000,
  );

  const admin = createAdminClient();

  try {
    const [a, z] = await Promise.all([
      fetchAsBase64(admin, baseline.storage_path),
      fetchAsBase64(admin, latest.storage_path),
    ]);

    const result = await compareImages(
      { ...a, scaleRef: baseline.scale_ref },
      { ...z, scaleRef: latest.scale_ref },
      days,
    );

    const { data: saved, error } = await supabase
      .from("skinscan_changes")
      .insert({
        lesion_id: b.lesion_id,
        user_id: user.id,
        baseline_image_id: baseline.id,
        latest_image_id: latest.id,
        days_between: days,
        diameter_delta_mm: result.diameterDeltaMm,
        area_delta_pct: result.areaDeltaPct,
        new_colours: result.newColours,
        border_change: result.borderChange,
        surface_change: result.surfaceChange,
        significant: result.significant,
        model_votes: result.votes.map((v) => ({ model: v.model, ok: v.ok, ms: v.ms, error: v.error ?? null })),
        summary: result.summary,
        comparable: result.comparable,
        incomparable_reason: result.incomparableReason,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Documented change is the strongest signal this app can produce, so it
    // raises the lesion's band directly rather than waiting for a new photo.
    if (result.bandBump) {
      const { data: lesion } = await supabase
        .from("skinscan_lesions")
        .select("latest_risk_band, next_review_due")
        .eq("id", b.lesion_id)
        .maybeSingle();
      const next = maxBand((lesion?.latest_risk_band as RiskBand) ?? "reassuring", result.bandBump);
      // Detecting a change must never push a review further out than it already
      // is. If the lesion is already on a three-day recall, a fourteen-day one
      // from here would be a downgrade dressed up as an escalation.
      const proposed = new Date(Date.now() + recallDaysFor(next) * 86_400_000).toISOString().slice(0, 10);
      const due = lesion?.next_review_due && lesion.next_review_due < proposed ? lesion.next_review_due : proposed;
      await supabase
        .from("skinscan_lesions")
        .update({ latest_risk_band: next, next_review_due: due })
        .eq("id", b.lesion_id);
    }

    return NextResponse.json({ id: saved.id, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Comparison failed" }, { status: 502 });
  }
}
