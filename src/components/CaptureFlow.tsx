"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { analyseImage, prepareForUpload, type QualityReport } from "@/lib/imageQuality";
import { RED_FLAGS, RISK_BANDS, type RiskBand } from "@/lib/clinical";
import { Field, NotDiagnosis, RiskBadge } from "@/components/ui";
import type { BodyPin } from "@/lib/types";

const BodyMap = dynamic(() => import("@/components/BodyMap"), { ssr: false });

const SCALE_OPTIONS = [
  { value: "none", label: "Nothing for scale", hint: "Size cannot be measured — only shape and colour." },
  { value: "coin_1euro", label: "A €1 coin", hint: "23.25mm across. The easiest reliable ruler you already own." },
  { value: "coin_2euro", label: "A €2 coin", hint: "25.75mm across." },
  { value: "sticker_10mm", label: "A 10mm sticker", hint: "If you have printed the calibration sticker." },
  { value: "ruler", label: "A ruler", hint: "Millimetre markings visible next to the spot." },
  { value: "dermoscope", label: "A dermatoscope attachment", hint: "A clip-on dermoscope such as a DermLite or MoleScope." },
];

interface AssessResponse {
  riskBand: RiskBand;
  agreement: number | null;
  rationale: string;
  recommendation: string;
  redFlags: string[];
  usableImage: boolean;
  votes: { label: string; ok: boolean; error?: string }[];
}

export default function CaptureFlow({
  lesionId,
  lesionLabel,
}: {
  lesionId?: string;
  lesionLabel?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [label, setLabel] = useState(lesionLabel ?? "");
  const [notes, setNotes] = useState("");
  const [scaleRef, setScaleRef] = useState("none");
  const [pin, setPin] = useState<{ pin: BodyPin; site: string; laterality: string } | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssessResponse | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(lesionId ?? null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setError(null);
    setResult(null);
    setBusy("Checking the photo…");
    try {
      const report = await analyseImage(picked);
      const prepared = await prepareForUpload(picked);
      setQuality(report);
      setFile(prepared);
      setPreview(URL.createObjectURL(prepared));
    } catch {
      setError("Could not read that image. Try a JPEG or PNG.");
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!file) return setError("Add a photo first.");
    if (!lesionId && !label.trim()) return setError("Give the spot a name so you recognise it later.");

    setError(null);
    setBusy("Saving…");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Sign in again.");

      let targetLesion = createdId;

      if (!targetLesion) {
        setBusy("Creating the entry…");
        const res = await fetch("/api/lesions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            body_site: pin?.site ?? "unknown",
            laterality: pin?.laterality ?? "n/a",
            body_pin: pin?.pin ?? null,
            notes: notes.trim() || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not create the entry");
        targetLesion = json.id;
        setCreatedId(json.id);
      }

      setBusy("Uploading the photo…");
      const path = `${user.id}/${targetLesion}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("skinscan")
        .upload(path, file, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const reg = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesion_id: targetLesion,
          storage_path: path,
          scale_ref: scaleRef,
          quality: quality ?? {},
        }),
      });
      const regJson = await reg.json();
      if (!reg.ok) throw new Error(regJson.error ?? "Could not save the photo");

      setBusy("Four models are describing it…");
      const assess = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_id: regJson.id,
          red_flags: Object.entries(flags)
            .filter(([, v]) => v)
            .map(([k]) => k),
        }),
      });
      const assessJson = await assess.json();
      if (!assess.ok) throw new Error(assessJson.error ?? "The description step failed");

      setResult(assessJson);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (result) {
    const band = RISK_BANDS[result.riskBand];
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className={`card band band-${result.riskBand}`} style={{ padding: "1.35rem" }}>
          <RiskBadge band={result.riskBand} />
          <h1 style={{ fontSize: "1.3rem", margin: "0.75rem 0 0.5rem", color: "var(--fg)" }}>{band.label}</h1>
          <p style={{ margin: "0 0 1rem", lineHeight: 1.6, color: "var(--fg-soft)" }}>{result.recommendation}</p>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "0.9rem" }}>
            <strong style={{ fontSize: "0.85rem", color: "var(--fg)" }}>What the models saw</strong>
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.89rem", lineHeight: 1.6, color: "var(--fg-soft)" }}>
              {result.rationale}
            </p>
          </div>

          {!result.usableImage && (
            <p style={{ margin: "0.9rem 0 0", fontSize: "0.86rem", lineHeight: 1.55, color: "#b45309" }}>
              The photo quality was poor enough that this result should not be trusted. Retake it and run it again.
            </p>
          )}

          <NotDiagnosis />
        </div>

        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <Link href={`/app/lesions/${createdId}`} className="btn btn-primary">
            Open this spot
          </Link>
          <Link href="/app/new" className="btn btn-ghost">
            Add another
          </Link>
          <Link href="/app/cases" className="btn btn-ghost">
            Ask a dermatologist
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.4rem" }}>
        {lesionId ? `New photo of ${lesionLabel}` : "Add a spot"}
      </h1>
      <p className="muted" style={{ margin: "0 0 1.5rem", lineHeight: 1.6 }}>
        {lesionId
          ? "Match the original photo as closely as you can — same distance, same light, same scale object. A comparison is only as good as the consistency between the two shots."
          : "Daylight, about 10-15cm away, flash off, and put a coin next to the spot so its width can actually be measured."}
      </p>

      <section className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <span className="label">The photo</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPick}
          style={{ display: "none" }}
        />

        {preview ? (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="The photo you selected"
              style={{ width: "100%", borderRadius: 10, display: "block", marginBottom: "0.75rem" }}
            />
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              Choose a different photo
            </button>
          </div>
        ) : (
          <button
            className="btn btn-ghost"
            onClick={() => fileRef.current?.click()}
            style={{ width: "100%", padding: "2.5rem 1rem", flexDirection: "column", borderStyle: "dashed" }}
          >
            <span style={{ fontSize: "1.6rem" }} aria-hidden>
              ⊕
            </span>
            <span>Take or choose a photo</span>
          </button>
        )}

        {quality && (
          <div style={{ marginTop: "0.9rem" }}>
            {quality.usable ? (
              <p style={{ margin: 0, fontSize: "0.86rem", color: "#15803d", fontWeight: 600 }}>
                Photo quality looks good.
              </p>
            ) : (
              <div>
                <p style={{ margin: "0 0 0.4rem", fontSize: "0.86rem", color: "#b45309", fontWeight: 600 }}>
                  Worth retaking:
                </p>
                <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "grid", gap: "0.35rem" }}>
                  {quality.reasons.map((r) => (
                    <li key={r} className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>
                      {r}
                    </li>
                  ))}
                </ul>
                <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
                  You can carry on anyway — the result will just be less reliable, and you will be told so.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <Field
          label="What is in the photo for scale?"
          hint="Without a reference object, apparent size changes with how close you held the camera, so growth cannot be measured. This is the single thing that most improves a mole log."
        >
          <select className="select" value={scaleRef} onChange={(e) => setScaleRef(e.target.value)}>
            {SCALE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="muted" style={{ margin: "-0.5rem 0 0", fontSize: "0.8rem" }}>
          {SCALE_OPTIONS.find((o) => o.value === scaleRef)?.hint}
        </p>
      </section>

      {!lesionId && (
        <>
          <section className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
            <Field label="Name it" hint="Something you will recognise in six months. “Left shoulder blade, dark one” beats “mole 3”.">
              <input
                className="input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Left shoulder blade, dark one"
                maxLength={120}
              />
            </Field>
            <Field label="Anything you want to note" hint="How long it has been there, whether it itches, whether anyone has looked at it before.">
              <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </Field>
          </section>

          <section className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
            <span className="label">Where is it? Rotate the model and click the spot.</span>
            <BodyMap
              pins={pin ? [{ id: "new", label: label || "New spot", pin: pin.pin, band: null }] : []}
              placing
              onPlace={(p, site, laterality) => setPin({ pin: p, site, laterality })}
              height={400}
            />
            <p className="muted" style={{ fontSize: "0.82rem", margin: "0.6rem 0 0", lineHeight: 1.5 }}>
              {pin
                ? `Pinned: ${pin.pin.mesh} (${pin.site}${pin.laterality !== "midline" ? `, ${pin.laterality}` : ""}). Click again to move it.`
                : "Optional, but the reason you will still know which spot this was next year."}
            </p>
          </section>
        </>
      )}

      <section className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <span className="label">Does any of this apply?</span>
        <p className="muted" style={{ margin: "0 0 0.85rem", fontSize: "0.84rem", lineHeight: 1.55 }}>
          These matter more than the photo does. A camera cannot see bleeding, itching, or how fast something appeared —
          and these are exactly the signs that change the advice.
        </p>
        <div style={{ display: "grid", gap: "0.55rem" }}>
          {RED_FLAGS.map((f) => (
            <label
              key={f.key}
              style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", fontSize: "0.89rem", lineHeight: 1.5, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={!!flags[f.key]}
                onChange={(e) => setFlags((p) => ({ ...p, [f.key]: e.target.checked }))}
                style={{ marginTop: "0.2rem", width: 16, height: 16, accentColor: "var(--brand)", flexShrink: 0 }}
              />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </section>

      {error && (
        <p style={{ color: "#b91c1c", fontSize: "0.88rem", margin: "0 0 0.75rem" }} role="alert">
          {error}
        </p>
      )}

      <button className="btn btn-primary" onClick={submit} disabled={!!busy || !file} style={{ width: "100%", padding: "0.85rem" }}>
        {busy ?? "Save and describe it"}
      </button>
      <p className="muted" style={{ fontSize: "0.78rem", textAlign: "center", margin: "0.75rem 0 0", lineHeight: 1.5 }}>
        The photo is sent to the AI providers only when you press this. It is never used to train anything.
      </p>
    </div>
  );
}
