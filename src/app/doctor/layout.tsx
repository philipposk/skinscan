import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Case queue" };

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/doctor");

  const { data: doctor } = await supabase
    .from("skinscan_doctors")
    .select("full_name, verified_at, accepting_cases")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header className="no-print" style={{ borderBottom: "1px solid var(--line)", background: "var(--card)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0.75rem 1.25rem", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/doctor" style={{ textDecoration: "none", fontWeight: 700 }}>
            <span aria-hidden style={{ color: "var(--brand)" }}>◎</span> SkinScan · clinician
          </Link>
          <span className="muted" style={{ marginLeft: "auto", fontSize: "0.85rem" }}>
            {doctor?.full_name ?? user.email}
          </span>
          <Link href="/app" className="btn btn-ghost" style={{ padding: "0.4rem 0.7rem" }}>
            My own log
          </Link>
        </div>
      </header>

      <div style={{ flex: 1, maxWidth: 1080, width: "100%", margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
        {doctor?.verified_at ? (
          children
        ) : (
          <div className="card" style={{ padding: "1.5rem", maxWidth: 560, margin: "2rem auto" }}>
            <h1 style={{ fontSize: "1.2rem", margin: "0 0 0.5rem" }}>Not verified yet</h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
              {doctor
                ? "Your registration is with us. We check every licence number against the national register before switching an account on, so this is a manual step."
                : "This area is for dermatologists reviewing cases. If you are a clinician and want to review, email hello@6x7.gr with your licence number and country."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
