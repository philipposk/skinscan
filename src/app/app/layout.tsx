import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageAssistantWidget from "@/components/PageAssistantWidget";

export const dynamic = "force-dynamic";

const CONSENT_VERSION = "2026-08-29";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app");

  const { data: profile } = await supabase
    .from("skinscan_profiles")
    .select("consent_version, role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  // Hard gate. No health data is written or read until Article 9 consent for the
  // current version exists.
  const consented = profile?.consent_version === CONSENT_VERSION;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        className="no-print"
        style={{
          borderBottom: "1px solid var(--line)",
          background: "var(--card)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "0.75rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <Link href="/app" style={{ textDecoration: "none", fontWeight: 700, display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span aria-hidden style={{ color: "var(--brand)" }}>◎</span> SkinScan
          </Link>
          <nav style={{ display: "flex", gap: "0.25rem", marginLeft: "auto", flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/app" className="btn btn-ghost" style={{ border: "none", padding: "0.45rem 0.7rem" }}>
              My skin
            </Link>
            <Link href="/app/cases" className="btn btn-ghost" style={{ border: "none", padding: "0.45rem 0.7rem" }}>
              Doctor reviews
            </Link>
            {profile?.role === "doctor" && (
              <Link href="/doctor" className="btn btn-ghost" style={{ border: "none", padding: "0.45rem 0.7rem" }}>
                Case queue
              </Link>
            )}
            <Link href="/app/settings" className="btn btn-ghost" style={{ border: "none", padding: "0.45rem 0.7rem" }}>
              Settings
            </Link>
            <Link href="/app/new" className="btn btn-primary" style={{ marginLeft: "0.35rem" }}>
              Add a spot
            </Link>
          </nav>
        </div>
      </header>

      <div style={{ flex: 1, maxWidth: 1080, width: "100%", margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
        {consented ? children : <ConsentRequired />}
      </div>

      {/* Only for consented, signed-in users: the assistant's routes spend money
          and it should not greet someone who has not agreed to anything yet. */}
      {consented && <PageAssistantWidget />}
    </div>
  );
}

function ConsentRequired() {
  return (
    <div className="card" style={{ padding: "1.5rem", maxWidth: 620, margin: "2rem auto" }}>
      <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>One thing before you start</h1>
      <p className="muted" style={{ lineHeight: 1.6, margin: "0 0 1.25rem" }}>
        Photos of your skin are health data under GDPR, so we need your explicit consent before
        storing any. It takes a minute and you can withdraw it at any time.
      </p>
      <Link href="/onboarding" className="btn btn-primary">
        Read it and continue
      </Link>
    </div>
  );
}
