import { NextResponse } from "next/server";
import { routerFromEnv } from "@page-assistant/server";
import { guard } from "@/lib/page-assistant/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

/** LLM proxy for the assistant's grounding loop. Keys never reach the browser. */
export async function POST(req: Request) {
  const gate = await guard("llm");
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await req.json();
    const llm = routerFromEnv();
    return NextResponse.json(await llm.complete(body));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[pa/llm]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
