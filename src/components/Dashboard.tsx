"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RiskBadge, Empty, formatDate } from "@/components/ui";
import type { Lesion } from "@/lib/types";
import type { MapPin } from "@/components/BodyMap";

// three.js has no business in the server bundle, and the map is below the fold
// on mobile anyway.
const BodyMap = dynamic(() => import("@/components/BodyMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 460, borderRadius: 14, border: "1px solid var(--line)", display: "grid", placeItems: "center" }}>
      <span className="muted" style={{ fontSize: "0.85rem" }}>Loading body map…</span>
    </div>
  ),
});

export default function Dashboard({ lesions }: { lesions: Lesion[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const pins: MapPin[] = useMemo(
    () =>
      lesions
        .filter((l) => l.body_pin)
        .map((l) => ({ id: l.id, label: l.label, pin: l.body_pin!, band: l.latest_risk_band })),
    [lesions],
  );

  const due = lesions.filter(
    (l) => l.next_review_due && new Date(l.next_review_due) <= new Date() && l.status === "monitoring",
  );

  const needsAttention = lesions.filter(
    (l) => l.latest_risk_band === "get_checked" || l.latest_risk_band === "see_doctor_soon",
  );

  if (!lesions.length) {
    return (
      <Empty
        title="Nothing logged yet"
        body="Start with the spots you already think about — the one on your back you keep checking, anything new, anything that has changed. One photo today is what makes the comparison in three months possible."
        action={
          <Link href="/app/new" className="btn btn-primary">
            Add your first spot
          </Link>
        }
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "minmax(0, 1fr)" }}>
      {needsAttention.length > 0 && (
        <div className="card band band-see_doctor_soon" style={{ padding: "1rem 1.15rem" }}>
          <strong style={{ fontSize: "0.98rem" }}>
            {needsAttention.length === 1 ? "One spot is" : `${needsAttention.length} spots are`} flagged for a doctor to
            look at
          </strong>
          <p className="muted" style={{ margin: "0.35rem 0 0.75rem", fontSize: "0.89rem", lineHeight: 1.55 }}>
            {needsAttention.map((l) => l.label).join(", ")}. That is a prompt to book an appointment, not a finding — most
            flagged spots turn out to be harmless.
          </p>
          <Link href="/app/cases" className="btn btn-ghost" style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
            Ask a dermatologist
          </Link>
        </div>
      )}

      {due.length > 0 && (
        <div className="card band band-monitor" style={{ padding: "1rem 1.15rem" }}>
          <strong style={{ fontSize: "0.98rem" }}>Time to re-photograph {due.length === 1 ? "a spot" : `${due.length} spots`}</strong>
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.89rem", lineHeight: 1.55 }}>
            {due.map((l) => l.label).join(", ")}. Take the new photo the same way as the old one — same distance, same
            light, coin in frame — or the comparison will be worthless.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <section>
          <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.65rem" }}>Where they are</h2>
          <BodyMap pins={pins} onSelect={setSelected} selectedId={selected} />
          <p className="muted" style={{ fontSize: "0.78rem", margin: "0.55rem 0 0", lineHeight: 1.5 }}>
            Drag to rotate, scroll to zoom. Click a marker to open that spot. Markers are coloured by the last
            assessment.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.65rem" }}>
            Your spots <span className="muted" style={{ fontWeight: 400 }}>({lesions.length})</span>
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
            {lesions.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/app/lesions/${l.id}`}
                  className="card"
                  style={{
                    display: "block",
                    padding: "0.85rem 1rem",
                    textDecoration: "none",
                    borderColor: selected === l.id ? "var(--brand)" : "var(--line)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: "0.95rem", display: "block" }}>{l.label}</strong>
                      <span className="muted" style={{ fontSize: "0.8rem" }}>
                        {l.body_site ?? "unknown site"}
                        {l.laterality && l.laterality !== "n/a" ? ` · ${l.laterality}` : ""} · {l.image_count}{" "}
                        {l.image_count === 1 ? "photo" : "photos"}
                      </span>
                    </div>
                    <RiskBadge band={l.latest_risk_band} size="sm" />
                  </div>
                  <div className="muted" style={{ fontSize: "0.76rem", marginTop: "0.45rem" }}>
                    Last photo {formatDate(l.last_image_at)}
                    {l.next_review_due && ` · next check due ${formatDate(l.next_review_due)}`}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
