import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Auth + budget gate for every assistant route.
 *
 * The assistant spends real money on someone else's API key, so no route is
 * anonymous and every one is counted. Limits are per user per day and generous
 * enough that a normal conversation never touches them.
 */
const LIMITS: Record<Kind, number> = {
  llm: 120,
  tts: 80,
  stt: 80,
};

export type Kind = "llm" | "tts" | "stt";

export async function guard(kind: Kind): Promise<{ userId: string } | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: allowed, error } = await admin.rpc("skinscan_assistant_take", {
    p_user: user.id,
    p_kind: kind,
    p_limit: LIMITS[kind],
  });

  // A counter failure must not take the assistant down, but it is worth seeing.
  if (error) console.error("[pa/budget]", error.message);

  if (allowed === false) {
    return NextResponse.json(
      { error: "You have reached today's assistant limit. It resets at midnight UTC." },
      { status: 429 },
    );
  }

  return { userId: user.id };
}
