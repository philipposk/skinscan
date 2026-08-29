import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CaptureFlow from "@/components/CaptureFlow";

export const dynamic = "force-dynamic";
export const metadata = { title: "New photo" };

export default async function AddPhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: lesion } = await supabase.from("skinscan_lesions").select("id, label").eq("id", id).maybeSingle();
  if (!lesion) notFound();

  return <CaptureFlow lesionId={lesion.id} lesionLabel={lesion.label} />;
}
