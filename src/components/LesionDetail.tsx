"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignedImage } from "@/components/SignedImage";
import { NotDiagnosis, RiskBadge, formatDate, daysBetween } from "@/components/ui";
import { CHANGE_THRESHOLDS } from "@/lib/clinical";
import type { Assessment, Lesion, LesionImage } from "@/lib/types";

interface Change {
  id: string;
  days_between: number;
  diameter_delta_mm: number | null;
  area_delta_pct: number | null;
  new_colours: string[];
  significant: boolean;
  comparable: boolean;
  incomparable_reason: string | null;
  summary: string | null;
  created_at: string;
}

export default function LesionDetail({
  lesion,
  images,
  assessments,
  changes,
}: {
  lesion: Lesion;
  images: LesionImage[];
  assessments: Assessment[];
  changes: Change[];
}) {
  const router = useRouter();
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [sliderPct, setSliderPct] = useState(50);
  const [deleting, setDeleting] = useState(false);

  const baseline = images[0];
  const latest = images[images.length - 1];
  const gap = baseline && latest ? daysBetween(baseline.captured_at, latest.captured_at) : 0;
  const canCompare = images.length >= 2 && gap >= CHANGE_THRESHOLDS.minDaysForComparison;
  const latestChange = changes[0];

  async function runCompare() {
    setComparing(true);
    setCompareError(null);
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesion_id: lesion.id }),
    });
    const json = await res.json();
    setComparing(false);
    if (!res.ok) setCompareError(json.error ?? "Comparison failed");
    else router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete "${lesion.label}" and all ${images.length} of its photos? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/lesions?id=${lesion.id}`, { method: "DELETE" });
    if (res.ok) router.push("/app");
    else setDeleting(false);
  }

  const measured = images.filter((i) => typeof i.lesion_diameter_mm === "number");

  return (
    <div>
      <Link href="/app" className="no-print" style={{ color: "var(--brand)", textDecoration: "none", fontSize: "0.88rem" }}>
        ← All spots
      </Link>

      <header style={{ margin: "0.85rem 0 1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.35rem", letterSpacing: "-0.01em" }}>{lesion.label}</h1>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            {lesion.body_site ?? "unknown site"}
            {lesion.laterality && lesion.laterality !== "n/a" ? ` · ${lesion.laterality}` : ""} · first logged{" "}
            {formatDate(lesion.created_at)}
            {lesion.next_review_due && ` · next check due ${formatDate(lesion.next_review_due)}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <RiskBadge band={lesion.latest_risk_band} />
          <Link href={`/app/lesions/${lesion.id}/photo`} className="btn btn-primary no-print">
            Add a photo
          </Link>
        </div>
      </header>

      {lesion.notes && (
        <p className="card" style={{ padding: "0.9rem 1.1rem", margin: "0 0 1.25rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
          {lesion.notes}
        </p>
      )}

      {/* ---- Change over time: the reason this app exists ---- */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem" }}>Change over time</h2>

        {images.length < 2 ? (
          <div className="card" style={{ padding: "1.25rem" }}>
            <p style={{ margin: 0, lineHeight: 1.6, color: "var(--fg-soft)", fontSize: "0.92rem" }}>
              One photo so far. A single picture of a mole tells you very little — what matters is whether it changes.
              Come back in about three months, photograph it the same way, and this section becomes the most useful
              part of the app.
            </p>
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: "1rem", marginBottom: "0.85rem" }}>
              <div
                style={{
                  position: "relative",
                  aspectRatio: "1 / 1",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "var(--line)",
                }}
              >
                <SignedImage
                  path={baseline.storage_path}
                  alt={`Baseline photo from ${formatDate(baseline.captured_at)}`}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    clipPath: `inset(0 0 0 ${sliderPct}%)`,
                  }}
                >
                  <SignedImage
                    path={latest.storage_path}
                    alt={`Latest photo from ${formatDate(latest.captured_at)}`}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${sliderPct}%`,
                    width: 2,
                    background: "#fff",
                    boxShadow: "0 0 6px rgba(0,0,0,0.5)",
                  }}
                />
                <span style={badgeStyle("left")}>{formatDate(baseline.captured_at)}</span>
                <span style={badgeStyle("right")}>{formatDate(latest.captured_at)}</span>
              </div>

              <input
                className="no-print"
                type="range"
                min={0}
                max={100}
                value={sliderPct}
                onChange={(e) => setSliderPct(Number(e.target.value))}
                aria-label="Slide to compare the two photos"
                style={{ width: "100%", marginTop: "0.75rem", accentColor: "var(--brand)" }}
              />
              <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", textAlign: "center" }}>
                {gap} days apart · drag to wipe between them
              </p>
            </div>

            {latestChange ? (
              <div
                className={`card band ${latestChange.significant ? "band-get_checked" : "band-reassuring"}`}
                style={{ padding: "1.1rem 1.25rem" }}
              >
                <strong style={{ fontSize: "0.96rem", color: "var(--fg)" }}>
                  {!latestChange.comparable
                    ? "These two photos are not comparable"
                    : latestChange.significant
                      ? "It has changed"
                      : "No meaningful change"}
                </strong>
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.9rem", lineHeight: 1.6, color: "var(--fg-soft)" }}>
                  {latestChange.comparable ? latestChange.summary : latestChange.incomparable_reason}
                </p>
                {latestChange.comparable && (
                  <ul className="muted" style={{ margin: "0.7rem 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem", display: "grid", gap: "0.3rem" }}>
                    {latestChange.diameter_delta_mm !== null && (
                      <li>
                        Width changed by about {latestChange.diameter_delta_mm > 0 ? "+" : ""}
                        {latestChange.diameter_delta_mm.toFixed(1)}mm over {latestChange.days_between} days
                      </li>
                    )}
                    {latestChange.area_delta_pct !== null && (
                      <li>Area changed by roughly {latestChange.area_delta_pct.toFixed(0)}%</li>
                    )}
                    {latestChange.new_colours.length > 0 && (
                      <li>New colour reported: {latestChange.new_colours.join(", ")}</li>
                    )}
                  </ul>
                )}
                <NotDiagnosis compact />
              </div>
            ) : (
              <div className="card no-print" style={{ padding: "1.1rem 1.25rem" }}>
                <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", lineHeight: 1.6, color: "var(--fg-soft)" }}>
                  {canCompare
                    ? "Compare the first and most recent photos. The models are told to be sceptical — different lighting and angle make moles look changed when they are not."
                    : `Photos taken less than ${CHANGE_THRESHOLDS.minDaysForComparison} days apart cannot be meaningfully compared. Yours are ${gap} days apart.`}
                </p>
                <button className="btn btn-primary" onClick={runCompare} disabled={!canCompare || comparing}>
                  {comparing ? "Comparing…" : "Compare first and latest"}
                </button>
                {compareError && (
                  <p style={{ color: "#b91c1c", fontSize: "0.85rem", margin: "0.7rem 0 0" }}>{compareError}</p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {measured.length > 1 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem" }}>Measured width</h2>
          <div className="card" style={{ padding: "1.1rem 1.25rem" }}>
            <SizeTrend images={measured} />
          </div>
        </section>
      )}

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem" }}>
          Every photo <span className="muted" style={{ fontWeight: 400 }}>({images.length})</span>
        </h2>
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {[...images].reverse().map((img) => {
            const a = assessments.find((x) => x.image_id === img.id);
            return (
              <div key={img.id} className="card" style={{ padding: "0.9rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <SignedImage
                  path={img.storage_path}
                  alt={`Photo from ${formatDate(img.captured_at)}`}
                  style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.92rem" }}>{formatDate(img.captured_at)}</strong>
                    {a && <RiskBadge band={a.risk_band} size="sm" />}
                  </div>
                  <p className="muted" style={{ margin: "0.3rem 0 0", fontSize: "0.8rem" }}>
                    {img.scale_ref && img.scale_ref !== "none" ? `Scale: ${img.scale_ref.replace(/_/g, " ")}` : "No scale reference"}
                    {img.lesion_diameter_mm ? ` · about ${img.lesion_diameter_mm}mm wide` : ""}
                    {img.is_baseline ? " · baseline" : ""}
                  </p>
                  {a?.rationale && (
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", lineHeight: 1.55, color: "var(--fg-soft)" }}>
                      {a.rationale}
                    </p>
                  )}
                  {a && a.agreement !== null && a.agreement < 0.5 && (
                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.82rem", color: "#b45309" }}>
                      The models disagreed on this one — worth a human opinion.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="no-print" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: "1.25rem" }}>
        <Link href={`/app/cases/new?lesion=${lesion.id}`} className="btn btn-primary">
          Ask a dermatologist about this
        </Link>
        <button className="btn btn-ghost" onClick={() => window.print()}>
          Print for a clinic visit
        </button>
        <button className="btn btn-ghost" onClick={remove} disabled={deleting} style={{ marginLeft: "auto", color: "#b91c1c" }}>
          {deleting ? "Deleting…" : "Delete this spot"}
        </button>
      </div>
    </div>
  );
}

function badgeStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    bottom: 8,
    [side]: 8,
    background: "rgba(0,0,0,0.62)",
    color: "#fff",
    fontSize: "0.7rem",
    fontWeight: 600,
    padding: "0.2rem 0.45rem",
    borderRadius: 5,
  };
}

/** Inline SVG rather than a chart library — one series, six points, no bundle. */
function SizeTrend({ images }: { images: LesionImage[] }) {
  const pts = images.map((i) => ({ t: new Date(i.captured_at).getTime(), mm: i.lesion_diameter_mm! }));
  const minT = Math.min(...pts.map((p) => p.t));
  const maxT = Math.max(...pts.map((p) => p.t));
  const maxMm = Math.max(...pts.map((p) => p.mm)) * 1.15;
  const W = 100;
  const H = 40;
  const x = (t: number) => (maxT === minT ? W / 2 : ((t - minT) / (maxT - minT)) * (W - 6) + 3);
  const y = (mm: number) => H - (mm / maxMm) * (H - 6) - 3;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(2)},${y(p.mm).toFixed(2)}`).join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];
  const delta = last.mm - first.mm;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 120, overflow: "visible" }} role="img" aria-label="Measured width over time">
        <path d={d} fill="none" stroke="var(--brand)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => (
          <circle key={i} cx={x(p.t)} cy={y(p.mm)} r={1.4} fill="var(--brand)" />
        ))}
      </svg>
      <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", lineHeight: 1.55 }}>
        {first.mm.toFixed(1)}mm on {formatDate(new Date(first.t).toISOString())} → {last.mm.toFixed(1)}mm on{" "}
        {formatDate(new Date(last.t).toISOString())} ({delta >= 0 ? "+" : ""}
        {delta.toFixed(1)}mm). These are estimates from photographs, accurate to roughly a millimetre at best, and only
        where a scale object was in frame.
      </p>
    </>
  );
}
