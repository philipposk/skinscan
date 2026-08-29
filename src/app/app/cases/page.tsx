import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Empty, formatDate } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Doctor reviews" };

const STATUS_COPY: Record<string, { label: string; note: string }> = {
  draft: { label: "Draft", note: "Not sent yet." },
  awaiting_payment: { label: "Awaiting payment", note: "Nothing has been sent to a doctor yet." },
  paid: { label: "In the queue", note: "Waiting for a dermatologist to pick it up." },
  assigned: { label: "With a dermatologist", note: "A dermatologist has taken your case." },
  in_review: { label: "Being reviewed", note: "A dermatologist is reading it now." },
  answered: { label: "Answered", note: "Your written opinion is ready." },
  closed: { label: "Closed", note: "" },
  refunded: { label: "Refunded", note: "This case was refunded." },
};

export default async function CasesPage() {
  const supabase = await createClient();
  const { data: cases } = await supabase
    .from("skinscan_cases")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.5rem", margin: 0, letterSpacing: "-0.01em" }}>Doctor reviews</h1>
        <Link href="/app/cases/new" className="btn btn-primary">
          Ask a dermatologist
        </Link>
      </div>

      <p className="muted" style={{ margin: "0 0 1.5rem", lineHeight: 1.6, maxWidth: "62ch" }}>
        A licensed dermatologist reads your whole history for a spot — every photo and every date, not one picture —
        and writes back within 48 hours. €29 per case, no subscription. If nobody answers, you are refunded.
      </p>

      {!cases?.length ? (
        <Empty
          title="No reviews yet"
          body="Worth doing when the app flags something, when the models disagree with each other, or simply when a spot has been bothering you and you would rather ask a person."
          action={
            <Link href="/app/cases/new" className="btn btn-primary">
              Start a case
            </Link>
          }
        />
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.6rem" }}>
          {cases.map((c) => (
            <li key={c.id}>
              <Link href={`/app/cases/${c.id}`} className="card" style={{ display: "block", padding: "1rem 1.15rem", textDecoration: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "0.95rem" }}>Case {c.human_ref}</strong>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: c.status === "answered" ? "#15803d" : "var(--fg-soft)",
                    }}
                  >
                    {STATUS_COPY[c.status]?.label ?? c.status}
                  </span>
                </div>
                <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  {STATUS_COPY[c.status]?.note} Started {formatDate(c.created_at)}
                  {c.answered_at && ` · answered ${formatDate(c.answered_at)}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
