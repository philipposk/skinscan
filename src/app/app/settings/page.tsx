import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Settings from "@/components/Settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: audit } = await supabase
    .from("skinscan_audit")
    .select("action, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", margin: "0 0 1.25rem", letterSpacing: "-0.01em" }}>Settings</h1>
      <Settings email={user.email ?? ""} accessLog={audit ?? []} />
    </>
  );
}
