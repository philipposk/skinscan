import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Empty, formatDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DoctorQueue() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS already limits this to the unassigned paid queue plus this doctor's own
  // cases, so no extra filtering is needed here.
  const { data: cases } = await supabase
    .from("skinscan_cases")
    .select("*")
    .in("status", ["paid", "assigned", "in_review"])
    .order("submitted_at", { ascending: true });

  const mine = (cases ?? []).filter((c) => c.assigned_doctor_id === user?.id);
  const queue = (cases ?? []).filter((c) => !c.assigned_doctor_id);

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", margin: "0 0 1.25rem", letterSpacing: "-0.01em" }}>Case queue</h1>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.65rem" }}>
          Yours <span className="muted" style={{ fontWeight: 400 }}>({mine.length})</span>
        </h2>
        {mine.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>Nothing assigned to you.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.55rem" }}>
            {mine.map((c) => (
              <li key={c.id}>
                <Link href={`/doctor/case/${c.id}`} className="card" style={{ display: "block", padding: "0.9rem 1.1rem", textDecoration: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.93rem" }}>{c.human_ref}</strong>
                    <span className="muted" style={{ fontSize: "0.8rem" }}>
                      due {formatDate(c.due_at)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.65rem" }}>
          Unclaimed <span className="muted" style={{ fontWeight: 400 }}>({queue.length})</span>
        </h2>
        {queue.length === 0 ? (
          <Empty title="Queue is empty" body="Nothing waiting. New paid cases appear here in the order they were submitted." />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.55rem" }}>
            {queue.map((c) => (
              <li key={c.id}>
                <Link href={`/doctor/case/${c.id}`} className="card" style={{ display: "block", padding: "0.9rem 1.1rem", textDecoration: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.93rem" }}>{c.human_ref}</strong>
                    <span className="muted" style={{ fontSize: "0.8rem" }}>submitted {formatDate(c.submitted_at)}</span>
                  </div>
                  {c.patient_question && (
                    <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", lineHeight: 1.5 }}>
                      {c.patient_question.slice(0, 160)}
                      {c.patient_question.length > 160 ? "…" : ""}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
