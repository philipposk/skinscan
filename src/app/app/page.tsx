import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/Dashboard";
import type { Lesion } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "My skin" };

export default async function AppHome() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("skinscan_lesions")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", margin: "0 0 1.25rem", letterSpacing: "-0.01em" }}>My skin</h1>
      <Dashboard lesions={(data ?? []) as Lesion[]} />
    </>
  );
}
