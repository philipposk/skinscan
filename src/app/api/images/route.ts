import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Registers a file the browser already uploaded straight to storage. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b?.lesion_id || !b?.storage_path) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // The bucket policy already pins uploads to the caller's own folder; reject
  // anything that claims otherwise before it reaches the database.
  if (!String(b.storage_path).startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { count } = await supabase
    .from("skinscan_images")
    .select("id", { count: "exact", head: true })
    .eq("lesion_id", b.lesion_id);

  const { data, error } = await supabase
    .from("skinscan_images")
    .insert({
      lesion_id: b.lesion_id,
      user_id: user.id,
      storage_path: b.storage_path,
      captured_at: b.captured_at ?? new Date().toISOString(),
      width: b.width ?? null,
      height: b.height ?? null,
      scale_ref: b.scale_ref ?? "none",
      mm_per_px: b.mm_per_px ?? null,
      quality: b.quality ?? {},
      is_baseline: (count ?? 0) === 0,
    })
    .select("id, is_baseline")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, is_baseline: data.is_baseline });
}
