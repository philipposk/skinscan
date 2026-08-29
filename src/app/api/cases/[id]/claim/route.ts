import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SLA_HOURS = 48;

/** A verified doctor takes an unassigned, paid case off the queue. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: doctor } = await supabase
    .from("skinscan_doctors")
    .select("id, verified_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!doctor?.verified_at) return NextResponse.json({ error: "Not a verified doctor" }, { status: 403 });

  const admin = createAdminClient();

  // Conditional update is the lock: two doctors clicking at once, only the one
  // whose update still matches `assigned_doctor_id is null` wins.
  const { data: claimed, error } = await admin
    .from("skinscan_cases")
    .update({
      assigned_doctor_id: user.id,
      assigned_at: new Date().toISOString(),
      status: "assigned",
      due_at: new Date(Date.now() + SLA_HOURS * 3_600_000).toISOString(),
    })
    .eq("id", id)
    .eq("status", "paid")
    .is("assigned_doctor_id", null)
    .select("id, user_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!claimed) return NextResponse.json({ error: "Another doctor already took this case" }, { status: 409 });

  await admin.from("skinscan_audit").insert({
    actor_id: user.id,
    actor_role: "doctor",
    action: "claim_case",
    subject_user_id: claimed.user_id,
    case_id: id,
  });

  return NextResponse.json({ ok: true });
}
