import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LesionDetail from "@/components/LesionDetail";
import type { Assessment, Lesion, LesionImage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LesionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lesion } = await supabase.from("skinscan_lesions").select("*").eq("id", id).maybeSingle();
  if (!lesion) notFound();

  const [{ data: images }, { data: assessments }, { data: changes }] = await Promise.all([
    supabase.from("skinscan_images").select("*").eq("lesion_id", id).order("captured_at", { ascending: true }),
    supabase.from("skinscan_assessments").select("*").eq("lesion_id", id).order("created_at", { ascending: false }),
    supabase.from("skinscan_changes").select("*").eq("lesion_id", id).order("created_at", { ascending: false }),
  ]);

  return (
    <LesionDetail
      lesion={lesion as Lesion}
      images={(images ?? []) as LesionImage[]}
      assessments={(assessments ?? []) as Assessment[]}
      changes={(changes ?? []) as never[]}
    />
  );
}
