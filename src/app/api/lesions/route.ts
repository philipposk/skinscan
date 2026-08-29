import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BODY_SITES } from "@/lib/clinical";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b?.label) return NextResponse.json({ error: "A name is required" }, { status: 400 });

  const bodySite = BODY_SITES.includes(b.body_site) ? b.body_site : "unknown";

  const { data, error } = await supabase
    .from("skinscan_lesions")
    .insert({
      user_id: user.id,
      label: String(b.label).slice(0, 120),
      body_site: bodySite,
      laterality: ["left", "right", "midline", "n/a"].includes(b.laterality) ? b.laterality : "n/a",
      body_pin: b.body_pin ?? null,
      first_noticed_on: b.first_noticed_on || null,
      notes: b.notes ? String(b.notes).slice(0, 2000) : null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof b.label === "string") patch.label = b.label.slice(0, 120);
  if (typeof b.notes === "string") patch.notes = b.notes.slice(0, 2000);
  if (["monitoring", "stable", "resolved", "excised", "archived"].includes(b.status)) patch.status = b.status;
  if (b.body_pin) patch.body_pin = b.body_pin;
  if (BODY_SITES.includes(b.body_site)) patch.body_site = b.body_site;

  // RLS restricts this to the caller's own rows; the eq is belt and braces.
  const { error } = await supabase.from("skinscan_lesions").update(patch).eq("id", b.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Remove the files first — a cascade would orphan them in the bucket.
  const { data: images } = await supabase.from("skinscan_images").select("storage_path").eq("lesion_id", id);
  if (images?.length) {
    await supabase.storage.from("skinscan").remove(images.map((i) => i.storage_path));
  }

  const { error } = await supabase.from("skinscan_lesions").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
