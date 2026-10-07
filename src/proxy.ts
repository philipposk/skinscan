import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const cookieDomain =
  process.env.NODE_ENV === "production" ? ".6x7.gr" : undefined;

const COOKIE_NAME = "sb-6x7-auth";

// Vercel kills a proxy that runs too long and shows a bare "504 MIDDLEWARE_INVOCATION_TIMEOUT" page, which
// is what visitors got on 15 Sep 2026 while the shared database was overloaded. Each Supabase request gets
// AUTH_REQUEST_MS; the whole check gets AUTH_DEADLINE_MS, because a token refresh retries network errors for
// up to 30 s on its own.
const AUTH_REQUEST_MS = 3000;
const AUTH_DEADLINE_MS = 5000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_REQUEST_MS);
  init?.signal?.addEventListener("abort", () => controller.abort(), { once: true });
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isProtected(path: string) {
  return path.startsWith("/app") || path.startsWith("/doctor") || path.startsWith("/onboarding");
}

function toLogin(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", path);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  // No session cookie ("sb-6x7-auth", or its chunks ".0", ".1"…) means signed out: nothing to refresh or
  // ask Supabase about.
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name === COOKIE_NAME || c.name.startsWith(`${COOKIE_NAME}.`));
  if (!hasSession) return isProtected(path) ? toLogin(request, path) : response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: COOKIE_NAME,
        domain: cookieDomain,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the token and writes the rotated cookie. Do not put logic between
  // createServerClient and getUser().
  const result = await Promise.race([
    supabase.auth.getUser(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), AUTH_DEADLINE_MS)),
  ]);
  // Supabase didn't answer. Don't send a signed-in visitor to /login (it would be just as slow); let the
  // request through. The /app, /doctor and /onboarding layouts check the session themselves.
  if (!result || result.error?.name === "AuthRetryableFetchError") return response;

  if (isProtected(path) && !result.data.user) return toLogin(request, path);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|google.*\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb)$).*)",
  ],
};
