import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GDPR Article 17. Deletes the image files first, then the account — a cascade
 * alone would leave the photographs sitting in the bucket forever.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: images } = await admin.from("skinscan_images").select("storage_path").eq("user_id", user.id);
  if (images?.length) {
    await admin.storage.from("skinscan").remove(images.map((i) => i.storage_path));
  }
  // Anything the browser wrote but never registered.
  const { data: leftovers } = await admin.storage.from("skinscan").list(user.id, { limit: 1000 });
  if (leftovers?.length) {
    await admin.storage.from("skinscan").remove(leftovers.map((f) => `${user.id}/${f.name}`));
  }

  // Deleting the auth user cascades every skinscan_* row via the FK chain.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
