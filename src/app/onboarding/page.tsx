"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Field } from "@/components/ui";

const CONSENT_VERSION = "2026-08-29";

const CONSENTS = [
  {
    key: "health_data",
    required: true,
    title: "Storing photographs of my skin",
    body: "Photos of your skin are special-category health data under Article 9 GDPR. They are stored encrypted in the EU (Frankfurt), are never publicly readable, and GPS is stripped in your browser before upload.",
  },
  {
    key: "ai_processing",
    required: true,
    title: "Sending a photo to AI providers to be described",
    body: "When you ask for a description, the image is sent over an encrypted connection to Google, OpenAI, Anthropic and OpenRouter under their zero-retention API terms, without your name or email. Nothing is sent until you press the button.",
  },
  {
    key: "terms",
    required: true,
    title: "I understand this does not diagnose anything",
    body: "SkinScan records and describes. It cannot tell you whether a spot is cancer, and it cannot rule anything out. A reassuring result is not a clean bill of health. I will not use it instead of seeing a doctor.",
  },
  {
    key: "research_optin",
    required: false,
    title: "Help improve skin datasets later",
    body: "Not active yet, and nothing happens if you tick it today. If we ever contribute anonymised images to open research, we would ask you again first. Untick it and everything else still works.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [profile, setProfile] = useState({
    year_of_birth: "",
    sex_at_birth: "prefer_not_to_say",
    fitzpatrick: "",
    personal_history_skin_cancer: false,
    family_history_melanoma: false,
    immunosuppressed: false,
    many_moles: false,
    history_of_sunburns: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredOk = CONSENTS.filter((c) => c.required).every((c) => checked[c.key]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: CONSENT_VERSION,
        consents: CONSENTS.map((c) => ({ kind: c.key, granted: !!checked[c.key] })),
        profile: {
          ...profile,
          year_of_birth: profile.year_of_birth ? Number(profile.year_of_birth) : null,
          fitzpatrick: profile.fitzpatrick ? Number(profile.fitzpatrick) : null,
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save. Try again.");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.4rem" }}>Before you upload anything</h1>
      <p className="muted" style={{ lineHeight: 1.6, margin: "0 0 1.5rem" }}>
        Two minutes, then you never see this again. The full wording is on the{" "}
        <Link href="/legal" style={{ color: "var(--brand)" }}>
          legal page
        </Link>
        .
      </p>

      <div style={{ display: "grid", gap: "0.7rem", marginBottom: "2rem" }}>
        {CONSENTS.map((c) => (
          <label
            key={c.key}
            className="card"
            style={{
              padding: "1rem 1.1rem",
              display: "flex",
              gap: "0.85rem",
              cursor: "pointer",
              borderColor: checked[c.key] ? "var(--brand)" : "var(--line)",
            }}
          >
            <input
              type="checkbox"
              checked={!!checked[c.key]}
              onChange={(e) => setChecked((p) => ({ ...p, [c.key]: e.target.checked }))}
              style={{ marginTop: "0.25rem", width: 18, height: 18, accentColor: "var(--brand)", flexShrink: 0 }}
            />
            <div>
              <strong style={{ fontSize: "0.96rem" }}>
                {c.title}
                {!c.required && <span className="muted" style={{ fontWeight: 500 }}> — optional</span>}
              </strong>
              <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.87rem", lineHeight: 1.55 }}>
                {c.body}
              </p>
            </div>
          </label>
        ))}
      </div>

      <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.35rem" }}>A few things about you</h2>
      <p className="muted" style={{ margin: "0 0 1.25rem", fontSize: "0.88rem", lineHeight: 1.6 }}>
        These do not change what the AI says about a photo. They shorten how often you are reminded
        to re-check a spot, and they are shown to a dermatologist if you ever send a case. All
        optional.
      </p>

      <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <Field label="Year of birth">
            <input
              className="input"
              type="number"
              min={1900}
              max={2026}
              placeholder="1990"
              value={profile.year_of_birth}
              onChange={(e) => setProfile((p) => ({ ...p, year_of_birth: e.target.value }))}
            />
          </Field>
          <Field label="Sex at birth">
            <select
              className="select"
              value={profile.sex_at_birth}
              onChange={(e) => setProfile((p) => ({ ...p, sex_at_birth: e.target.value }))}
            >
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="intersex">Intersex</option>
            </select>
          </Field>
        </div>

        <Field
          label="Skin type"
          hint="Used so the models judge colour against your own skin rather than against pale skin. Published skin-AI accuracy is materially worse on darker skin, and you deserve to know that up front."
        >
          <select
            className="select"
            value={profile.fitzpatrick}
            onChange={(e) => setProfile((p) => ({ ...p, fitzpatrick: e.target.value }))}
          >
            <option value="">Not sure</option>
            <option value="1">I — always burns, never tans</option>
            <option value="2">II — burns easily, tans slightly</option>
            <option value="3">III — sometimes burns, tans gradually</option>
            <option value="4">IV — rarely burns, tans easily</option>
            <option value="5">V — very rarely burns, tans very easily</option>
            <option value="6">VI — never burns, deeply pigmented</option>
          </select>
        </Field>

        <span className="label">Anything that applies</span>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {[
            ["personal_history_skin_cancer", "I have had a skin cancer before"],
            ["family_history_melanoma", "A close relative has had a melanoma"],
            ["immunosuppressed", "I take immunosuppressant medication or have a condition that suppresses my immune system"],
            ["many_moles", "I have a lot of moles (more than about 50)"],
            ["history_of_sunburns", "I have had blistering sunburns"],
          ].map(([key, label]) => (
            <label key={key} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", fontSize: "0.9rem", lineHeight: 1.5, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={profile[key as keyof typeof profile] as boolean}
                onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.checked }))}
                style={{ marginTop: "0.2rem", width: 16, height: 16, accentColor: "var(--brand)", flexShrink: 0 }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "#b91c1c", fontSize: "0.87rem" }}>{error}</p>}

      <button className="btn btn-primary" disabled={!requiredOk || saving} style={{ width: "100%", padding: "0.8rem" }}>
        {saving ? "Saving…" : requiredOk ? "Agree and start" : "Tick the three required boxes to continue"}
      </button>
    </form>
  );
}
