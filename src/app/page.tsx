import Link from "next/link";
import { LIMITATIONS, RISK_BANDS } from "@/lib/clinical";

const STEPS = [
  {
    n: "1",
    title: "Photograph the spot",
    body: "The app checks the photo before it accepts it — focus, lighting, glare, distance. Put a €1 coin next to the mole and it can measure the actual width in millimetres.",
  },
  {
    n: "2",
    title: "Pin it on the body map",
    body: "Rotate the model, click where the spot is. Six months later you will not remember whether it was the left or right shoulder blade. The map will.",
  },
  {
    n: "3",
    title: "Four models describe it",
    body: "Gemini, GPT-4o, Claude and Qwen each describe the same photo independently. Where they disagree, you are told — disagreement is a reason to see a person.",
  },
  {
    n: "4",
    title: "Come back in three months",
    body: "This is the part that matters. A single photo of a mole says very little. The same mole photographed twice, months apart, says a lot.",
  },
  {
    n: "5",
    title: "Ask a dermatologist",
    body: "If you want a human answer, send the whole history — every photo, every date, the measurements — to a licensed dermatologist and get a written opinion back.",
  },
];

export default function Home() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "0 1.25rem 5rem" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.5rem 0",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontWeight: 700, fontSize: "1.1rem" }}>
          <span
            aria-hidden
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--brand)",
              display: "grid",
              placeItems: "center",
              color: "var(--brand-ink)",
              fontSize: 16,
            }}
          >
            ◎
          </span>
          SkinScan
        </div>
        <nav style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <Link href="/legal" className="btn btn-ghost">
            How it is regulated
          </Link>
          <Link href="/login" className="btn btn-primary">
            Start a log
          </Link>
        </nav>
      </header>

      <section style={{ padding: "2.5rem 0 1rem" }}>
        <p
          style={{
            display: "inline-block",
            fontSize: "0.78rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--brand)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "0.3rem 0.7rem",
            margin: "0 0 1.1rem",
          }}
        >
          Not a diagnosis · a photo diary for your skin
        </p>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.1rem)", lineHeight: 1.1, margin: "0 0 1rem", letterSpacing: "-0.02em" }}>
          The useful question is not
          <br />
          <em style={{ color: "var(--brand)", fontStyle: "normal" }}>&ldquo;is this bad?&rdquo;</em> — it is{" "}
          <em style={{ color: "var(--brand)", fontStyle: "normal" }}>&ldquo;has it changed?&rdquo;</em>
        </h1>
        <p style={{ fontSize: "1.15rem", lineHeight: 1.6, maxWidth: "60ch", color: "var(--fg-soft)", margin: "0 0 1.75rem" }}>
          No app can tell you whether a mole is cancer from a phone photo, and any app that claims to
          is lying to you. What software genuinely can do is remember: hold every spot on your body,
          photographed in the same way on known dates, measured against a coin, so that a real change
          is obvious instead of invisible.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/login" className="btn btn-primary" style={{ padding: "0.8rem 1.4rem", fontSize: "1rem" }}>
            Start your log — free
          </Link>
          <Link href="#limits" className="btn btn-ghost" style={{ padding: "0.8rem 1.4rem", fontSize: "1rem" }}>
            What it cannot do
          </Link>
        </div>
      </section>

      <section style={{ margin: "3.5rem 0" }}>
        <h2 style={{ fontSize: "1.4rem", margin: "0 0 1.25rem" }}>How it works</h2>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
          {STEPS.map((s) => (
            <li key={s.n} className="card" style={{ padding: "1.1rem 1.25rem", display: "flex", gap: "1rem" }}>
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "var(--brand)",
                  color: "var(--brand-ink)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                }}
              >
                {s.n}
              </span>
              <div>
                <h3 style={{ margin: "0.15rem 0 0.4rem", fontSize: "1.02rem" }}>{s.title}</h3>
                <p style={{ margin: 0, color: "var(--fg-soft)", lineHeight: 1.6, fontSize: "0.95rem" }}>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section style={{ margin: "3.5rem 0" }}>
        <h2 style={{ fontSize: "1.4rem", margin: "0 0 0.5rem" }}>What you get told</h2>
        <p style={{ color: "var(--fg-soft)", margin: "0 0 1.25rem", maxWidth: "62ch", lineHeight: 1.6 }}>
          Four outcomes, and every one of them is an instruction about what to do next rather than a
          claim about what the spot is. The wording is deliberate.
        </p>
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {(Object.keys(RISK_BANDS) as (keyof typeof RISK_BANDS)[]).map((k) => (
            <div key={k} className={`card band band-${k}`} style={{ padding: "0.9rem 1.1rem" }}>
              <strong style={{ fontSize: "0.98rem" }}>{RISK_BANDS[k].label}</strong>
              <p style={{ margin: "0.3rem 0 0", color: "var(--fg-soft)", fontSize: "0.9rem", lineHeight: 1.55 }}>
                {RISK_BANDS[k].blurb}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="limits" style={{ margin: "3.5rem 0", scrollMarginTop: "1rem" }}>
        <h2 style={{ fontSize: "1.4rem", margin: "0 0 0.5rem" }}>What it cannot do</h2>
        <p style={{ color: "var(--fg-soft)", margin: "0 0 1.25rem", maxWidth: "62ch", lineHeight: 1.6 }}>
          Every competitor buries this page. It is the most important one here, so it is on the front.
        </p>
        <ul className="card" style={{ margin: 0, padding: "1.25rem 1.25rem 1.25rem 2.5rem", display: "grid", gap: "0.85rem" }}>
          {LIMITATIONS.map((l) => (
            <li key={l} style={{ color: "var(--fg-soft)", lineHeight: 1.6, fontSize: "0.95rem" }}>
              {l}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ margin: "3.5rem 0" }}>
        <h2 style={{ fontSize: "1.4rem", margin: "0 0 1.25rem" }}>Price</h2>
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <div className="card" style={{ padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 0.2rem" }}>Logging</h3>
            <p style={{ fontSize: "1.7rem", fontWeight: 700, margin: "0 0 0.6rem" }}>Free</p>
            <p style={{ margin: 0, color: "var(--fg-soft)", fontSize: "0.92rem", lineHeight: 1.55 }}>
              Unlimited spots, unlimited photos, the body map, the AI description, change detection
              between visits, and reminders. The part that protects you is the part that costs nothing.
            </p>
          </div>
          <div className="card" style={{ padding: "1.25rem", borderColor: "var(--brand)" }}>
            <h3 style={{ margin: "0 0 0.2rem" }}>Dermatologist opinion</h3>
            <p style={{ fontSize: "1.7rem", fontWeight: 700, margin: "0 0 0.6rem" }}>
              €29 <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--fg-soft)" }}>per case</span>
            </p>
            <p style={{ margin: 0, color: "var(--fg-soft)", fontSize: "0.92rem", lineHeight: 1.55 }}>
              A licensed dermatologist reads your whole history — not one photo — and writes back
              within 48 hours with an impression, an urgency, and what to do. Pay per case, no
              subscription.
            </p>
          </div>
        </div>
      </section>

      <footer
        className="card"
        style={{ padding: "1.25rem", marginTop: "3rem", fontSize: "0.87rem", color: "var(--fg-soft)", lineHeight: 1.6 }}
      >
        <p style={{ margin: "0 0 0.6rem" }}>
          <strong style={{ color: "var(--fg)" }}>SkinScan is not a medical device and does not diagnose anything.</strong>{" "}
          It records photographs, describes what is visible in them, and prompts you to see a
          clinician. It cannot rule out skin cancer. If you are worried about a spot, see a doctor —
          with or without this app.
        </p>
        <p style={{ margin: 0 }}>
          Photos are stored encrypted in the EU (Frankfurt) and are never used to train anything.{" "}
          <Link href="/legal" style={{ color: "var(--brand)" }}>
            Privacy, terms and regulatory position
          </Link>{" "}
          · part of <a href="https://6x7.gr" style={{ color: "var(--brand)" }}>6x7.gr</a>
        </p>
      </footer>
    </main>
  );
}
