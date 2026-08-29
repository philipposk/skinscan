import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Redirect target for the magic link / OAuth round trip. Exchanging the code
// sets the shared sb-6x7-auth cookie on .6x7.gr.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
