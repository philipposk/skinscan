import Link from "next/link";
import { RISK_BANDS, type RiskBand } from "@/lib/clinical";

export function RiskBadge({ band, size = "md" }: { band: RiskBand | null; size?: "sm" | "md" }) {
  if (!band) {
    return (
      <span
        className="muted"
        style={{ fontSize: size === "sm" ? "0.75rem" : "0.82rem", fontWeight: 600 }}
      >
        Not assessed yet
      </span>
    );
  }
  const b = RISK_BANDS[band];
  return (
    <span
      className={`band-${band}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        fontSize: size === "sm" ? "0.75rem" : "0.82rem",
        fontWeight: 700,
        border: "1px solid currentColor",
        borderRadius: 999,
        padding: size === "sm" ? "0.12rem 0.5rem" : "0.22rem 0.65rem",
      }}
    >
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: "currentColor" }} />
      {b.label}
    </span>
  );
}

/**
 * Shown next to every AI output, every time. Not once at sign-up and then
 * hidden — the whole legal position rests on the user being told at the point
 * of use, so it is a component and not a footer.
 */
export function NotDiagnosis({ compact = false }: { compact?: boolean }) {
  return (
    <p
      style={{
        margin: compact ? "0.5rem 0 0" : "0.85rem 0 0",
        fontSize: compact ? "0.75rem" : "0.8rem",
        lineHeight: 1.55,
        color: "var(--fg-soft)",
        borderTop: "1px solid var(--line)",
        paddingTop: compact ? "0.5rem" : "0.7rem",
      }}
    >
      This is a description of a photograph, not a diagnosis. It cannot rule out skin cancer and a
      reassuring result does not mean a spot is harmless.{" "}
      <Link href="/legal" style={{ color: "var(--brand)" }}>
        Why
      </Link>
      .
    </p>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
      <h3 style={{ margin: "0 0 0.4rem", fontSize: "1.02rem" }}>{title}</h3>
      <p className="muted" style={{ margin: "0 auto 1.1rem", maxWidth: "44ch", lineHeight: 1.6, fontSize: "0.92rem" }}>
        {body}
      </p>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <span className="label">{label}</span>
      {children}
      {hint && (
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}
