import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const URGENCIES = ["routine", "soon_4_weeks", "urgent_1_week", "emergency"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b?.impression || !b?.recommendation || !URGENCIES.includes(b.urgency)) {
    return NextResponse.json({ error: "Impression, urgency and recommendation are all required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: theCase } = await admin
    .from("skinscan_cases")
    .select("id, user_id, assigned_doctor_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!theCase || theCase.assigned_doctor_id !== user.id) {
    return NextResponse.json({ error: "This case is not assigned to you" }, { status: 403 });
  }
  if (theCase.status === "answered" || theCase.status === "closed") {
    return NextResponse.json({ error: "This case has already been answered" }, { status: 409 });
  }

  // Stamp the clinician's identity onto the document itself. A signed review
  // has to stay readable and attributable even if the account is later deleted,
  // so it must not depend on a join to a row that might not be there.
  const { data: doctor } = await admin
    .from("skinscan_doctors")
    .select("full_name, license_number, license_country")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await admin.from("skinscan_reviews").insert({
    case_id: id,
    doctor_id: user.id,
    signed_by_name: doctor?.full_name ?? null,
    signed_by_license_number: doctor?.license_number ?? null,
    signed_by_license_country: doctor?.license_country ?? null,
    lesion_id: b.lesion_id ?? null,
    impression: String(b.impression).slice(0, 4000),
    differential: Array.isArray(b.differential) ? b.differential.slice(0, 8).map(String) : [],
    urgency: b.urgency,
    recommendation: String(b.recommendation).slice(0, 4000),
    refer_to: b.refer_to ? String(b.refer_to).slice(0, 200) : null,
    image_quality_sufficient: b.image_quality_sufficient !== false,
    cannot_assess_reason: b.cannot_assess_reason ? String(b.cannot_assess_reason).slice(0, 1000) : null,
    notes_to_patient: b.notes_to_patient ? String(b.notes_to_patient).slice(0, 4000) : null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin
    .from("skinscan_cases")
    .update({ status: "answered", answered_at: new Date().toISOString() })
    .eq("id", id);

  await admin.from("skinscan_audit").insert({
    actor_id: user.id,
    actor_role: "doctor",
    action: "answer_case",
    subject_user_id: theCase.user_id,
    case_id: id,
    meta: { urgency: b.urgency },
  });

  // An emergency verdict must not sit in an inbox waiting to be noticed.
  if (b.urgency === "emergency" && process.env.RESEND_API_KEY) {
    const { data: patient } = await admin.auth.admin.getUserById(theCase.user_id);
    if (patient?.user?.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM ?? "SkinScan <onboarding@resend.dev>",
          to: patient.user.email,
          subject: "Your SkinScan review needs urgent attention",
          text: `A dermatologist has reviewed your case and marked it as needing urgent medical attention.\n\nPlease open https://skinscan.6x7.gr/app/cases and read their advice now. If you cannot reach a doctor today, go to an emergency department. In Greece, EKAB is 166.`,
        }),
      }).catch(() => undefined);
    }
  }

  return NextResponse.json({ ok: true });
}
