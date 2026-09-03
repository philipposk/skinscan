import Link from "next/link";
import { EMERGENCY_COPY, LIMITATIONS } from "@/lib/clinical";

export const metadata = {
  title: "Privacy, terms and regulatory position",
  description: "What SkinScan is, what it legally is not, and exactly what happens to your photos.",
};

const S: React.CSSProperties = { margin: "0 0 0.85rem", lineHeight: 1.65, color: "var(--fg-soft)" };
const H: React.CSSProperties = { fontSize: "1.15rem", margin: "2.25rem 0 0.75rem", color: "var(--fg)" };

export default function LegalPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.25rem 5rem" }}>
      <Link href="/" style={{ color: "var(--brand)", textDecoration: "none", fontSize: "0.9rem" }}>
        ← SkinScan
      </Link>

      <h1 style={{ fontSize: "1.9rem", margin: "1.25rem 0 0.5rem", letterSpacing: "-0.02em" }}>
        What this is, and what it is not
      </h1>
      <p style={{ ...S, fontSize: "1.02rem" }}>
        Last updated 29 August 2026. Written in plain language on purpose — if you cannot understand
        what a health app does with your data, the consent you gave it is not worth much.
      </p>

      <h2 style={H}>SkinScan is not a medical device</h2>
      <p style={S}>
        Under EU Regulation 2017/745 (the Medical Device Regulation), software becomes a medical
        device when it is intended to diagnose, prevent, monitor, predict or treat a disease.
        Software intended for diagnosis or triage of a condition typically falls under Rule 11 and
        would need a notified body, a CE mark, and a clinical evaluation before it could legally be
        sold in the EU.
      </p>
      <p style={S}>
        SkinScan is deliberately built to sit outside that. Its stated purpose is to{" "}
        <strong style={{ color: "var(--fg)" }}>record photographs of your skin over time and describe
        what is visible in them</strong>. It does not tell you what a lesion is. It does not give a
        probability of any disease. It does not tell you that anything is safe, benign, or ruled out.
        Every output is either a description of what a photograph shows, or a prompt to go and be
        examined by a person.
      </p>
      <p style={S}>
        That is a real constraint on the product, not a form of words. The AI models are instructed
        never to name a condition, and the decision about what you are told to do is made by a fixed,
        published rule set based on the Glasgow 7-point checklist used by the NHS for referrals — not
        by a model.
      </p>

      <h2 style={H}>The dermatologist review is a different thing</h2>
      <p style={S}>
        When you pay for a review, a dermatologist licensed in an EU member state reads your case and
        writes an opinion. That is a genuine clinical opinion from a genuine clinician, and it is
        theirs, not the platform&rsquo;s. SkinScan operates as the software and payment layer between
        you and them. It is a remote, asynchronous opinion based on photographs, which is inherently
        more limited than an in-person examination — a dermatologist can and will tell you when they
        cannot answer from a photo and you need to be seen.
      </p>

      <h2 style={H}>What it cannot do</h2>
      <ul style={{ margin: "0 0 0.85rem", paddingLeft: "1.35rem", display: "grid", gap: "0.7rem" }}>
        {LIMITATIONS.map((l) => (
          <li key={l} style={{ lineHeight: 1.65, color: "var(--fg-soft)" }}>
            {l}
          </li>
        ))}
      </ul>
      <p
        className="card"
        style={{ padding: "1rem 1.15rem", margin: "1.25rem 0", borderColor: "#b91c1c", lineHeight: 1.6 }}
      >
        <strong>{EMERGENCY_COPY}</strong>
      </p>

      <h2 style={H}>Why a warning is usually a false alarm</h2>
      <p style={S}>
        This is worth understanding before you use any skin app, including this one. Melanoma is
        uncommon in the general population. Suppose a tool correctly flags 90 out of 100 real
        melanomas, and wrongly flags 10 out of every 100 harmless moles. In a group of 10,000 people
        where 10 genuinely have a melanoma, it flags 9 of the real ones — and about 1,000 harmless
        ones. So fewer than 1 in 100 warnings is a real find.
      </p>
      <p style={S}>
        That arithmetic is not a flaw in a particular product, it is what happens to any screening
        test applied to a low-prevalence population. It is why SkinScan words its highest outcome as
        &ldquo;see a doctor promptly&rdquo; rather than anything that sounds like a finding, and why
        you should treat a flag as a reason to book an appointment, never as a result.
      </p>

      <h2 style={H}>Your photos</h2>
      <p style={S}>
        Photographs of your skin are &ldquo;data concerning health&rdquo; under Article 9 GDPR —
        special-category data that needs your explicit, specific consent. You give that consent once,
        at sign-up, and it is recorded with a timestamp and version so you can see exactly what you
        agreed to.
      </p>
      <ul style={{ margin: "0 0 0.85rem", paddingLeft: "1.35rem", display: "grid", gap: "0.7rem", color: "var(--fg-soft)", lineHeight: 1.65 }}>
        <li>
          Photos are stored in a private encrypted bucket hosted in the EU (Frankfurt). They are
          never publicly readable — the app mints a short-lived signed link each time you view one.
        </li>
        <li>
          GPS coordinates are stripped from every photo in your browser, before upload. They never
          reach the server.
        </li>
        <li>
          Your photos are <strong style={{ color: "var(--fg)" }}>never used to train any model</strong>,
          by us or by anyone else, and are never sold or shared for advertising.
        </li>
        <li>
          To produce a description, a photo is sent to the AI providers listed below over an
          encrypted connection, under their zero-retention API terms. It is not attached to your name
          or email.
        </li>
        <li>
          A dermatologist can only see your photos through a case you have paid for and submitted.
          Every such access is written to an access log that <em>you</em> can read.
        </li>
        <li>
          You can export everything or delete everything from Settings. Deletion removes the image
          files themselves, not just the database rows.
        </li>
      </ul>

      <h2 style={H}>The in-app assistant</h2>
      <p style={S}>
        Signed-in pages carry a small assistant that helps you use the app — photo technique, what an
        outcome means, finding a spot you logged months ago, exporting your records. It is bound by
        the same rule the rest of the product is, and more strictly: it is instructed never to offer
        an opinion on whether a spot is dangerous, never to name a condition, and to send you to a
        doctor if you mention bleeding, a sore that will not heal, rapid growth, or a spot on a palm,
        sole or nail. If you push it, it refuses.
      </p>
      <p style={S}>
        <strong style={{ color: "var(--fg)" }}>It never receives your photographs.</strong> It can
        read the text side of your own log — the names you gave your spots, their body sites, dates,
        photo counts, outcomes and review status — and only when a question actually needs that. It
        does not read the page you are on. Conversations are kept for the browser session only and
        are gone when you close the tab, so nothing lingers on a shared computer. Voice is off unless
        you switch it on.
      </p>

      <h2 style={H}>Who processes your data</h2>
      <p style={S}>
        Supabase (database, authentication and encrypted file storage, EU/Frankfurt); Vercel
        (application hosting); Stripe (payments — Stripe never receives your photos or health data);
        and for image description and the in-app assistant, Google (Gemini), OpenAI, Anthropic and
        OpenRouter. Nothing is sent to an AI provider until you press the button that asks for a
        description, or type a message to the assistant.
      </p>

      <h2 style={H}>Terms, briefly</h2>
      <p style={S}>
        You must be 18 or older. Use SkinScan for your own skin, or for a child you are responsible
        for. Do not rely on it in place of medical care, and do not use it to decide against seeing a
        doctor. The free logging features are provided as-is with no warranty. Paid reviews are
        delivered by the reviewing clinician under their own professional responsibility and
        indemnity. You can close your account at any time; a paid case that has not yet been answered
        is refunded in full.
      </p>

      <h2 style={H}>Contact</h2>
      <p style={S}>
        Questions, data requests, or a complaint about a review:{" "}
        <a href="mailto:hello@6x7.gr" style={{ color: "var(--brand)" }}>
          hello@6x7.gr
        </a>
        . If you are in Greece and unhappy with how your data was handled, you can complain to the
        Hellenic Data Protection Authority (dpa.gr).
      </p>
    </main>
  );
}
