import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import NewCase from "@/components/NewCase";
import type { Lesion } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ask a dermatologist" };

export default async function NewCasePage() {
  const supabase = await createClient();
  const { data } = await supabase.from("skinscan_lesions").select("*").order("created_at", { ascending: false });

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.4rem" }}>Ask a dermatologist</h1>
      <p className="muted" style={{ margin: "0 0 1.5rem", lineHeight: 1.6, maxWidth: "62ch" }}>
        A remote opinion from photographs is more limited than being examined in person, and a good dermatologist will
        tell you when they cannot answer from a photo and you need to be seen. That is a real answer too.
      </p>
      <Suspense>
        <NewCase lesions={(data ?? []) as Lesion[]} priceCents={Number(process.env.CASE_PRICE_CENTS ?? 2900)} />
      </Suspense>
    </>
  );
}
