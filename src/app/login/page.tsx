"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const supabase = createClient();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") ? "That sign-in link did not work. Try again." : null);
  const [loading, setLoading] = useState(false);

  const redirectTo = typeof window !== "undefined" ? `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` : undefined;

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setError(error.message);
  }

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", padding: "1.5rem" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <Link href="/" style={{ textDecoration: "none", display: "block", textAlign: "center", marginBottom: "1.5rem", fontWeight: 700 }}>
          ◎ SkinScan
        </Link>

        <div className="card" style={{ padding: "1.5rem" }}>
          <h1 style={{ fontSize: "1.3rem", margin: "0 0 0.35rem" }}>Sign in</h1>
          <p className="muted" style={{ margin: "0 0 1.25rem", fontSize: "0.9rem", lineHeight: 1.55 }}>
            One login across every 6x7 app. Your skin photos stay private to your account and are
            never shown to anyone unless you send a case to a dermatologist yourself.
          </p>

          {sent ? (
            <p
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "1rem",
                margin: 0,
                fontSize: "0.92rem",
                lineHeight: 1.55,
              }}
            >
              Check <strong>{email}</strong> for a sign-in link. It expires in an hour.
            </p>
          ) : (
            <>
              <button onClick={signInWithGoogle} className="btn btn-ghost" style={{ width: "100%", marginBottom: "0.85rem" }}>
                Continue with Google
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "0.85rem 0", fontSize: "0.78rem", color: "var(--fg-soft)" }}>
                <span style={{ height: 1, flex: 1, background: "var(--line)" }} />
                or
                <span style={{ height: 1, flex: 1, background: "var(--line)" }} />
              </div>

              <form onSubmit={signInWithEmail}>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ marginBottom: "0.75rem" }}
                />
                <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
                  {loading ? "Sending…" : "Email me a sign-in link"}
                </button>
              </form>
            </>
          )}

          {error && (
            <p style={{ color: "#b91c1c", fontSize: "0.85rem", margin: "0.85rem 0 0" }}>{error}</p>
          )}
        </div>

        <p className="muted" style={{ fontSize: "0.8rem", textAlign: "center", marginTop: "1rem", lineHeight: 1.5 }}>
          SkinScan does not diagnose. It records and describes.{" "}
          <Link href="/legal" style={{ color: "var(--brand)" }}>
            Read why that distinction matters
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
