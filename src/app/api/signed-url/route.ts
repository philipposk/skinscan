import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TTL_SECONDS = 300;

/**
 * Mints a short-lived signed URL for one lesion photo.
 *
 * Two access paths, checked separately:
 *  - the owner, identified by the first path segment being their user id;
 *  - a verified doctor, but only for an image that hangs off a case currently
 *    assigned to them. That check runs in the database, and the read is logged.
 */
export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const owner = path.split("/")[0];

  if (owner !== user.id) {
    // Not the owner. The only other legitimate reader is the assigned doctor.
    const { data: image } = await admin
      .from("skinscan_images")
      .select("lesion_id, user_id")
      .eq("storage_path", path)
      .maybeSingle();

    if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: allowed } = await supabase.rpc("skinscan_doctor_may_read_lesion", {
      p_lesion: image.lesion_id,
    });

    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await admin.from("skinscan_audit").insert({
      actor_id: user.id,
      actor_role: "doctor",
      action: "view_image",
      subject_user_id: image.user_id,
      lesion_id: image.lesion_id,
      meta: { path },
    });
  }

  const { data, error } = await admin.storage.from("skinscan").createSignedUrl(path, TTL_SECONDS);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });

  return NextResponse.json(
    { url: data.signedUrl },
    { headers: { "Cache-Control": "private, max-age=120" } },
  );
}
