import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignedImage } from "@/components/SignedImage";
import ReviewForm from "@/components/ReviewForm";
import { RiskBadge, formatDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DoctorCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: theCase } = await supabase.from("skinscan_cases").select("*").eq("id", id).maybeSingle();
  if (!theCase) notFound();

  const claimed = theCase.assigned_doctor_id === user?.id;

  // Until the case is claimed, RLS blocks every lesion and image behind it, so
  // this deliberately returns nothing.
  const { data: links } = await supabase.from("skinscan_case_lesions").select("lesion_id").eq("case_id", id);
  const lesionIds = (links ?? []).map((l) => l.lesion_id);

  const { data: lesions } = lesionIds.length
    ? await supabase.from("skinscan_lesions").select("*").in("id", lesionIds)
    : { data: [] };
  const { data: images } = lesionIds.length
    ? await supabase.from("skinscan_images").select("*").in("lesion_id", lesionIds).order("captured_at")
    : { data: [] };
  const { data: assessments } = lesionIds.length
    ? await supabase.from("skinscan_assessments").select("*").in("lesion_id", lesionIds)
    : { data: [] };

  return (
    <div style={{ maxWidth: 860 }}>
      <Link href="/doctor" style={{ color: "var(--brand)", textDecoration: "none", fontSize: "0.88rem" }}>
        ← Queue
      </Link>

      <h1 style={{ fontSize: "1.4rem", margin: "0.85rem 0 0.3rem" }}>{theCase.human_ref}</h1>
      <p className="muted" style={{ margin: "0 0 1.5rem", fontSize: "0.87rem" }}>
        Submitted {formatDate(theCase.submitted_at)}
        {theCase.due_at && ` · due ${formatDate(theCase.due_at)}`}
      </p>

      <section className="card" style={{ padding: "1.15rem 1.25rem", marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "0.95rem", margin: "0 0 0.6rem" }}>What the patient asked</h2>
        <p style={{ margin: "0 0 0.6rem", fontSize: "0.92rem", lineHeight: 1.6 }}>
          {theCase.patient_question || <span className="muted">No question written.</span>}
        </p>
        {theCase.patient_reported_changes && (
          <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.6 }}>
            <strong>Reported changes / symptoms.</strong> {theCase.patient_reported_changes}
          </p>
        )}
      </section>

      {claimed &&
        (lesions ?? []).map((l) => {
          const imgs = (images ?? []).filter((i) => i.lesion_id === l.id);
          const a = (assessments ?? []).filter((x) => x.lesion_id === l.id).sort((x, y) => (x.created_at < y.created_at ? 1 : -1))[0];
          return (
            <section key={l.id} className="card" style={{ padding: "1.15rem 1.25rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                <h2 style={{ fontSize: "1rem", margin: 0 }}>{l.label}</h2>
                <RiskBadge band={l.latest_risk_band} size="sm" />
              </div>
              <p className="muted" style={{ margin: "0 0 0.85rem", fontSize: "0.83rem" }}>
                {l.body_site}
                {l.laterality && l.laterality !== "n/a" ? ` · ${l.laterality}` : ""} · first logged{" "}
                {formatDate(l.created_at)}
                {l.first_noticed_on && ` · patient first noticed ${formatDate(l.first_noticed_on)}`}
              </p>
              {l.notes && (
                <p style={{ margin: "0 0 0.85rem", fontSize: "0.89rem", lineHeight: 1.6 }}>
                  <strong>Patient note.</strong> {l.notes}
                </p>
              )}

              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
                {imgs.map((i) => (
                  <figure key={i.id} style={{ margin: 0 }}>
                    <SignedImage
                      path={i.storage_path}
                      alt={`${l.label} on ${formatDate(i.captured_at)}`}
                      style={{ width: 170, height: 170, objectFit: "cover", borderRadius: 8, display: "block" }}
                    />
                    <figcaption className="muted" style={{ fontSize: "0.72rem", marginTop: "0.3rem", textAlign: "center", lineHeight: 1.4 }}>
                      {formatDate(i.captured_at)}
                      <br />
                      {i.scale_ref && i.scale_ref !== "none" ? i.scale_ref.replace(/_/g, " ") : "no scale"}
                      {i.lesion_diameter_mm ? ` · ~${i.lesion_diameter_mm}mm` : ""}
                    </figcaption>
                  </figure>
                ))}
              </div>

              {a?.rationale && (
                <p className="muted" style={{ margin: 0, fontSize: "0.83rem", lineHeight: 1.55, borderTop: "1px solid var(--line)", paddingTop: "0.7rem" }}>
                  <strong>Automated description (not a diagnosis, for context only).</strong> {a.rationale}
                </p>
              )}
            </section>
          );
        })}

      <ReviewForm caseId={id} claimed={claimed} lesions={(lesions ?? []).map((l) => ({ id: l.id, label: l.label }))} />
    </div>
  );
}
