import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignedImage } from "@/components/SignedImage";
import { formatDate } from "@/components/ui";

export const dynamic = "force-dynamic";

const URGENCY: Record<string, { label: string; colour: string; note: string }> = {
  routine: { label: "Routine", colour: "#15803d", note: "No rush. Mention it at your next appointment." },
  soon_4_weeks: { label: "Within four weeks", colour: "#b45309", note: "Book an appointment in the next month." },
  urgent_1_week: { label: "Within one week", colour: "#c2410c", note: "Book an appointment this week." },
  emergency: { label: "Urgent", colour: "#b91c1c", note: "Seek medical attention now — today if you can." },
};

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: theCase } = await supabase.from("skinscan_cases").select("*").eq("id", id).maybeSingle();
  if (!theCase) notFound();

  const [{ data: links }, { data: reviews }] = await Promise.all([
    supabase.from("skinscan_case_lesions").select("lesion_id").eq("case_id", id),
    supabase.from("skinscan_reviews").select("*").eq("case_id", id).order("signed_at", { ascending: false }),
  ]);

  const lesionIds = (links ?? []).map((l) => l.lesion_id);
  const { data: lesions } = lesionIds.length
    ? await supabase.from("skinscan_lesions").select("*").in("id", lesionIds)
    : { data: [] };
  const { data: images } = lesionIds.length
    ? await supabase.from("skinscan_images").select("*").in("lesion_id", lesionIds).order("captured_at")
    : { data: [] };

  const review = reviews?.[0];
  const doctorName = review
    ? (await supabase.from("skinscan_doctors").select("full_name, license_country").eq("id", review.doctor_id).maybeSingle())
        .data
    : null;

  return (
    <div style={{ maxWidth: 720 }}>
      <Link href="/app/cases" className="no-print" style={{ color: "var(--brand)", textDecoration: "none", fontSize: "0.88rem" }}>
        ← All reviews
      </Link>

      <h1 style={{ fontSize: "1.4rem", margin: "0.85rem 0 0.3rem" }}>Case {theCase.human_ref}</h1>
      <p className="muted" style={{ margin: "0 0 1.5rem", fontSize: "0.88rem" }}>
        Started {formatDate(theCase.created_at)}
        {theCase.due_at && theCase.status !== "answered" && ` · answer due by ${formatDate(theCase.due_at)}`}
      </p>

      {theCase.status === "awaiting_payment" && (
        <div className="card band band-monitor" style={{ padding: "1.1rem 1.25rem", marginBottom: "1.5rem" }}>
          <strong style={{ color: "var(--fg)" }}>Not sent yet</strong>
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem", lineHeight: 1.55 }}>
            This case has not been paid for, so no dermatologist can see it. Start a new case to try again.
          </p>
        </div>
      )}

      {(theCase.status === "paid" || theCase.status === "assigned" || theCase.status === "in_review") && (
        <div className="card" style={{ padding: "1.1rem 1.25rem", marginBottom: "1.5rem" }}>
          <strong>
            {theCase.status === "paid" ? "In the queue" : "A dermatologist has your case"}
          </strong>
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem", lineHeight: 1.55 }}>
            You will get an email when the written opinion is ready. If anything changes in the meantime — bleeding,
            rapid growth, a new sore — do not wait for this. See a doctor.
          </p>
        </div>
      )}

      {review && (
        <section
          className="card"
          style={{ padding: "1.35rem", marginBottom: "1.5rem", borderLeft: `4px solid ${URGENCY[review.urgency].colour}` }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: URGENCY[review.urgency].colour }}>
            {URGENCY[review.urgency].label}
          </span>
          <h2 style={{ fontSize: "1.1rem", margin: "0.5rem 0 0.75rem" }}>What the dermatologist said</h2>

          {!review.image_quality_sufficient && (
            <p style={{ margin: "0 0 0.9rem", fontSize: "0.89rem", lineHeight: 1.6, color: "#b45309" }}>
              They noted the photographs were not good enough to judge properly.
              {review.cannot_assess_reason ? ` ${review.cannot_assess_reason}` : ""}
            </p>
          )}

          <div className="prose-note" style={{ fontSize: "0.95rem" }}>
            <p><strong>Impression.</strong> {review.impression}</p>
            {review.differential?.length > 0 && (
              <p><strong>Also considered.</strong> {review.differential.join(", ")}</p>
            )}
            <p><strong>What to do.</strong> {review.recommendation}</p>
            {review.refer_to && <p><strong>Where to go.</strong> {review.refer_to}</p>}
            {review.notes_to_patient && <p>{review.notes_to_patient}</p>}
          </div>

          <p className="muted" style={{ margin: "1rem 0 0", fontSize: "0.8rem", lineHeight: 1.55, borderTop: "1px solid var(--line)", paddingTop: "0.7rem" }}>
            {URGENCY[review.urgency].note} Signed {formatDate(review.signed_at)}
            {doctorName ? ` by ${doctorName.full_name}, registered in ${doctorName.license_country}` : ""}. This is a
            remote opinion based on photographs and does not replace an in-person examination.
          </p>
        </section>
      )}

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.75rem" }}>What you sent</h2>
        {theCase.patient_question && (
          <p className="card" style={{ padding: "0.9rem 1.1rem", margin: "0 0 0.85rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
            <strong>Your question.</strong> {theCase.patient_question}
          </p>
        )}
        {theCase.patient_reported_changes && (
          <p className="card" style={{ padding: "0.9rem 1.1rem", margin: "0 0 0.85rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
            <strong>What you noticed.</strong> {theCase.patient_reported_changes}
          </p>
        )}
        {(lesions ?? []).map((l) => (
          <div key={l.id} className="card" style={{ padding: "1rem", marginBottom: "0.7rem" }}>
            <strong style={{ fontSize: "0.93rem" }}>{l.label}</strong>
            <span className="muted" style={{ fontSize: "0.8rem", display: "block", marginTop: "0.2rem" }}>
              {l.body_site}
            </span>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem", flexWrap: "wrap" }}>
              {(images ?? [])
                .filter((i) => i.lesion_id === l.id)
                .map((i) => (
                  <figure key={i.id} style={{ margin: 0 }}>
                    <SignedImage
                      path={i.storage_path}
                      alt={`${l.label} on ${formatDate(i.captured_at)}`}
                      style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 6, display: "block" }}
                    />
                    <figcaption className="muted" style={{ fontSize: "0.7rem", marginTop: "0.25rem", textAlign: "center" }}>
                      {formatDate(i.captured_at)}
                    </figcaption>
                  </figure>
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
