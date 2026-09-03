import { NextResponse } from "next/server";
import { synthesize } from "@page-assistant/server";
import { guard } from "@/lib/page-assistant/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await guard("tts");
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await req.json();
    if (typeof body?.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    const { audio, contentType } = await synthesize(body);
    return new NextResponse(new Uint8Array(audio), { headers: { "Content-Type": contentType } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
