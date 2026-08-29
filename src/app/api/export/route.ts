import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** GDPR Article 20 — everything we hold, as one JSON file. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const [profile, lesions, images, assessments, changes, cases, reviews, consents, audit] = await Promise.all([
    supabase.from("skinscan_profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("skinscan_lesions").select("*").eq("user_id", user.id),
    supabase.from("skinscan_images").select("*").eq("user_id", user.id),
    supabase.from("skinscan_assessments").select("*").eq("user_id", user.id),
    supabase.from("skinscan_changes").select("*").eq("user_id", user.id),
    supabase.from("skinscan_cases").select("*").eq("user_id", user.id),
    supabase.from("skinscan_reviews").select("*"),
    supabase.from("skinscan_consents").select("*").eq("user_id", user.id),
    supabase.from("skinscan_audit").select("*").eq("subject_user_id", user.id),
  ]);

  // Signed links so the export is actually usable — the photos are the point.
  const paths = (images.data ?? []).map((i) => i.storage_path);
  const signed = paths.length
    ? (await supabase.storage.from("skinscan").createSignedUrls(paths, 3600)).data ?? []
    : [];

  const payload = {
    exported_at: new Date().toISOString(),
    note: "Photo links below expire one hour after this file was generated. Re-export to get fresh links.",
    account: { id: user.id, email: user.email },
    profile: profile.data,
    lesions: lesions.data,
    images: (images.data ?? []).map((img) => ({
      ...img,
      download_url: signed.find((s) => s.path === img.storage_path)?.signedUrl ?? null,
    })),
    assessments: assessments.data,
    changes: changes.data,
    cases: cases.data,
    reviews: reviews.data,
    consents: consents.data,
    access_log: audit.data,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="skinscan-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
