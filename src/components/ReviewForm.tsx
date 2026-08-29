"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui";

const URGENCIES = [
  { value: "routine", label: "Routine — no action needed beyond normal self-monitoring" },
  { value: "soon_4_weeks", label: "Within four weeks — should be examined in person" },
  { value: "urgent_1_week", label: "Within one week" },
  { value: "emergency", label: "Urgent — needs medical attention now" },
];

export default function ReviewForm({ caseId, claimed, lesions }: { caseId: string; claimed: boolean; lesions: { id: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    lesion_id: lesions[0]?.id ?? "",
    impression: "",
    differential: "",
    urgency: "routine",
    recommendation: "",
    refer_to: "",
    image_quality_sufficient: true,
    cannot_assess_reason: "",
    notes_to_patient: "",
  });

  async function claim() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/cases/${caseId}/claim`, { method: "POST" });
    setBusy(false);
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Could not claim");
    else router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/cases/${caseId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        differential: form.differential
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    setBusy(false);
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Could not submit");
    else router.push("/doctor");
  }

  if (!claimed) {
    return (
      <div className="card" style={{ padding: "1.25rem" }}>
        <p style={{ margin: "0 0 1rem", lineHeight: 1.6, fontSize: "0.92rem" }}>
          Claim this case to see the patient&rsquo;s photographs. Claiming starts a 48-hour clock and is logged against
          your account.
        </p>
        {error && <p style={{ color: "#b91c1c", fontSize: "0.87rem", margin: "0 0 0.7rem" }}>{error}</p>}
        <button className="btn btn-primary" onClick={claim} disabled={busy}>
          {busy ? "Claiming…" : "Claim this case"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: "1.25rem" }}>
      <h2 style={{ fontSize: "1.05rem", margin: "0 0 1rem" }}>Your opinion</h2>

      {lesions.length > 1 && (
        <Field label="Which spot does this concern?">
          <select className="select" value={form.lesion_id} onChange={(e) => setForm((p) => ({ ...p, lesion_id: e.target.value }))}>
            {lesions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Impression" hint="Written for the patient to read. Plain language.">
        <textarea
          className="textarea"
          required
          value={form.impression}
          onChange={(e) => setForm((p) => ({ ...p, impression: e.target.value }))}
        />
      </Field>

      <Field label="Differential" hint="Comma separated. Optional.">
        <input className="input" value={form.differential} onChange={(e) => setForm((p) => ({ ...p, differential: e.target.value }))} />
      </Field>

      <Field label="Urgency">
        <select className="select" value={form.urgency} onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value }))}>
          {URGENCIES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="What should they do" hint="Concrete next step, not general advice.">
        <textarea
          className="textarea"
          required
          value={form.recommendation}
          onChange={(e) => setForm((p) => ({ ...p, recommendation: e.target.value }))}
        />
      </Field>

      <Field label="Where to go" hint="Type of clinic or specialty. Optional.">
        <input className="input" value={form.refer_to} onChange={(e) => setForm((p) => ({ ...p, refer_to: e.target.value }))} />
      </Field>

      <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", fontSize: "0.9rem", lineHeight: 1.5, cursor: "pointer", marginBottom: "1rem" }}>
        <input
          type="checkbox"
          checked={!form.image_quality_sufficient}
          onChange={(e) => setForm((p) => ({ ...p, image_quality_sufficient: !e.target.checked }))}
          style={{ marginTop: "0.2rem", width: 16, height: 16, accentColor: "var(--brand)", flexShrink: 0 }}
        />
        <span>The photographs are not good enough for me to judge properly</span>
      </label>

      {!form.image_quality_sufficient && (
        <Field label="Why not">
          <textarea
            className="textarea"
            value={form.cannot_assess_reason}
            onChange={(e) => setForm((p) => ({ ...p, cannot_assess_reason: e.target.value }))}
          />
        </Field>
      )}

      <Field label="Anything else for the patient" hint="Optional.">
        <textarea
          className="textarea"
          value={form.notes_to_patient}
          onChange={(e) => setForm((p) => ({ ...p, notes_to_patient: e.target.value }))}
        />
      </Field>

      {error && <p style={{ color: "#b91c1c", fontSize: "0.87rem", margin: "0 0 0.7rem" }}>{error}</p>}

      <button className="btn btn-primary" disabled={busy} style={{ width: "100%", padding: "0.8rem" }}>
        {busy ? "Sending…" : "Sign and send to the patient"}
      </button>
      <p className="muted" style={{ fontSize: "0.78rem", margin: "0.7rem 0 0", lineHeight: 1.5 }}>
        Sent under your own professional responsibility. It is signed with your name and registration country and
        cannot be edited afterwards.
      </p>
    </form>
  );
}
