import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

function cookieDomainFor(host?: string | null): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  const h = (host ?? "").split(":")[0].toLowerCase();
  // .6x7.dk mirror gets its own shared cookie domain; every other host keeps .6x7.gr (unchanged).
  return h === "6x7.dk" || h.endsWith(".6x7.dk") ? ".6x7.dk" : ".6x7.gr";
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: "sb-6x7-auth",
        domain: cookieDomainFor((((h)=>h.get("x-forwarded-host") ?? h.get("host"))(await headers()))),
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot set cookies; the proxy refreshes instead.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS, so it is only ever used for three things:
 * signing image URLs after an explicit access check, writing the audit log, and
 * the Stripe webhook. Never import this into a client component.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
