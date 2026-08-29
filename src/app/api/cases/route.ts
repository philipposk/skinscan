import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PRICE_CENTS = Number(process.env.CASE_PRICE_CENTS ?? 2900);

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const b = await req.json().catch(() => null);
  const lesionIds: string[] = Array.isArray(b?.lesion_ids) ? b.lesion_ids.slice(0, 5) : [];
  if (!lesionIds.length) return NextResponse.json({ error: "Pick at least one spot" }, { status: 400 });

  // Every lesion must have at least one photo, otherwise the doctor is being
  // paid to look at nothing.
  const { data: owned } = await supabase
    .from("skinscan_lesions")
    .select("id, image_count")
    .in("id", lesionIds)
    .eq("user_id", user.id);

  if (!owned || owned.length !== lesionIds.length) {
    return NextResponse.json({ error: "One of those spots could not be found" }, { status: 400 });
  }
  if (owned.some((l) => l.image_count === 0)) {
    return NextResponse.json({ error: "Add a photo to each spot before sending it to a doctor" }, { status: 400 });
  }

  const { data: created, error } = await supabase
    .from("skinscan_cases")
    .insert({
      user_id: user.id,
      status: "awaiting_payment",
      patient_question: b?.question ? String(b.question).slice(0, 2000) : null,
      patient_reported_changes: b?.changes ? String(b.changes).slice(0, 2000) : null,
      price_cents: PRICE_CENTS,
    })
    .select("id, human_ref")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: linkErr } = await supabase
    .from("skinscan_case_lesions")
    .insert(lesionIds.map((lesion_id) => ({ case_id: created.id, lesion_id })));
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  return NextResponse.json({ id: created.id, human_ref: created.human_ref });
}
