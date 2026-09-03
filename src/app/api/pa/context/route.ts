import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * The only window the assistant has onto the user's own data.
 *
 * Deliberately narrow: labels, sites, dates, counts, the outcome band, and case
 * status. No photographs, no storage paths, no model rationales, no free-text
 * notes — the assistant does not need them and every extra field is one more
 * piece of health data crossing to an LLM provider.
 *
 * RLS scopes all of it to the caller; the selects carry no user filter because
 * the policies already do.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const [{ data: lesions }, { data: cases }] = await Promise.all([
    supabase
      .from("skinscan_lesions")
      .select("id, label, body_site, laterality, image_count, last_image_at, latest_risk_band, next_review_due, status")
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("skinscan_cases")
      .select("id, human_ref, status, answered_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const answered = (cases ?? []).filter((c) => c.status === "answered").map((c) => c.id);
  const { data: reviews } = answered.length
    ? await supabase.from("skinscan_reviews").select("case_id, urgency").in("case_id", answered)
    : { data: [] };

  return NextResponse.json(
    {
      spots: (lesions ?? []).map((l) => ({
        id: l.id,
        label: l.label,
        site: [l.body_site, l.laterality && l.laterality !== "n/a" ? l.laterality : null].filter(Boolean).join(", ") || "unknown",
        band: l.latest_risk_band,
        photos: l.image_count,
        lastPhoto: l.last_image_at,
        dueOn: l.next_review_due,
        overdue: !!l.next_review_due && l.next_review_due <= today,
      })),
      cases: (cases ?? []).map((c) => ({
        ref: c.human_ref,
        status: c.status,
        answered: c.status === "answered",
        urgency: (reviews ?? []).find((r) => r.case_id === c.id)?.urgency ?? null,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
