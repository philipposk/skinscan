import { createBrowserClient } from "@supabase/ssr";

// Same cookie as every other 6x7 app, so one login carries across *.6x7.gr.
const cookieDomain =
  process.env.NODE_ENV === "production" ? ".6x7.gr" : undefined;

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: "sb-6x7-auth",
        domain: cookieDomain,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
  );
}
