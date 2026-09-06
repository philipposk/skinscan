import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Read at request time, not at build time: a key added in Vercel after the last
// deploy must change the answer without a rebuild.
export const dynamic = "force-dynamic";

/**
 * What voice this deployment can actually back, for the assistant's settings panel.
 *
 * Without this route the widget assumes the server has no voice at all and greys out
 * ElevenLabs and Whisper — while `/v1/voice/tts` and `/v1/voice/stt` next door happily
 * use the keys we do hold. A settings screen that contradicts the behaviour is worse
 * than none, so the answer comes from the same env vars the SDK's `synthesize` and
 * `transcribe` read: ElevenLabs (or OpenAI) for speech out, Whisper via OpenAI for
 * speech in.
 *
 * Unauthenticated, unlike every other assistant route. It returns three booleans and
 * two vendor names — no health data, no key material, and no spend — and the panel may
 * open before a token exists. Putting it behind `guard()` would also charge a user's
 * daily budget for drawing a settings dialog.
 */
export async function GET() {
  const providers: string[] = [];
  if (process.env.ELEVENLABS_API_KEY) providers.push("elevenlabs");
  if (process.env.OPENAI_API_KEY) providers.push("openai");

  return NextResponse.json(
    {
      tts: { server: providers.length > 0, providers },
      stt: { server: !!process.env.OPENAI_API_KEY },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
