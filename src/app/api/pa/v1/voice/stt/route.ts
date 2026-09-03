import { NextResponse } from "next/server";
import { transcribe } from "@page-assistant/server";
import { guard } from "@/lib/page-assistant/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await guard("stt");
  if (gate instanceof NextResponse) return gate;

  try {
    const buf = Buffer.from(await req.arrayBuffer());
    if (!buf.length) return NextResponse.json({ error: "audio body required" }, { status: 400 });
    return NextResponse.json({ text: await transcribe(buf, "audio.webm") });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
