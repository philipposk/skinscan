"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Field, RiskBadge } from "@/components/ui";
import type { Lesion } from "@/lib/types";

export default function NewCase({ lesions, priceCents }: { lesions: Lesion[]; priceCents: number }) {
  const params = useSearchParams();
  const preselect = params.get("lesion");
  const [picked, setPicked] = useState<string[]>(preselect ? [preselect] : []);
  const [question, setQuestion] = useState("");
  const [changes, setChanges] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withPhotos = lesions.filter((l) => l.image_count > 0);

  async function submit() {
    if (!picked.length) return setError("Pick at least one spot.");
    setBusy(true);
    setError(null);
    try {
      const created = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesion_ids: picked, question, changes }),
      });
      const cj = await created.json();
      if (!created.ok) throw new Error(cj.error ?? "Could not create the case");

      const checkout = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: cj.id }),
      });
      const sj = await checkout.json();
      if (!checkout.ok) throw new Error(sj.error ?? "Could not start the payment");
      window.location.href = sj.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (!withPhotos.length) {
    return (
      <div className="card" style={{ padding: "1.5rem" }}>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          You need at least one spot with a photo before a dermatologist has anything to look at.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <section className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <span className="label">Which spots should the dermatologist look at?</span>
        <p className="muted" style={{ margin: "0 0 0.85rem", fontSize: "0.84rem", lineHeight: 1.55 }}>
          Up to five in one case, at no extra cost. They see every photo you have of each one, with the dates.
        </p>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {withPhotos.map((l) => (
            <label
              key={l.id}
              className="card"
              style={{
                padding: "0.75rem 0.9rem",
                display: "flex",
                gap: "0.7rem",
                alignItems: "center",
                cursor: "pointer",
                borderColor: picked.includes(l.id) ? "var(--brand)" : "var(--line)",
                boxShadow: "none",
              }}
            >
              <input
                type="checkbox"
                checked={picked.includes(l.id)}
                disabled={!picked.includes(l.id) && picked.length >= 5}
                onChange={(e) =>
                  setPicked((p) => (e.target.checked ? [...p, l.id] : p.filter((x) => x !== l.id)))
                }
                style={{ width: 16, height: 16, accentColor: "var(--brand)" }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: "0.9rem", display: "block" }}>{l.label}</strong>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  {l.body_site} · {l.image_count} {l.image_count === 1 ? "photo" : "photos"}
                </span>
              </span>
              <RiskBadge band={l.latest_risk_band} size="sm" />
            </label>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <Field label="What do you want to ask?" hint="Be specific. “Should this be removed?” gets a better answer than “is it ok?”.">
          <textarea className="textarea" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} />
        </Field>
        <Field
          label="Has anything changed, or does it feel different?"
          hint="Itching, bleeding, tenderness, how quickly it appeared. A dermatologist weights this heavily and a photo cannot show it."
        >
          <textarea className="textarea" value={changes} onChange={(e) => setChanges(e.target.value)} maxLength={2000} />
        </Field>
      </section>

      {error && <p style={{ color: "#b91c1c", fontSize: "0.88rem", margin: "0 0 0.75rem" }}>{error}</p>}

      <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ width: "100%", padding: "0.85rem" }}>
        {busy ? "Opening payment…" : `Continue to payment — €${(priceCents / 100).toFixed(2)}`}
      </button>
      <p className="muted" style={{ fontSize: "0.79rem", margin: "0.75rem 0 0", lineHeight: 1.55, textAlign: "center" }}>
        Payment is handled by Stripe; we never see your card details and Stripe never sees your photos. If no
        dermatologist answers within 48 hours you are refunded in full.
      </p>
    </div>
  );
}
