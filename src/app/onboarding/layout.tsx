import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Before you start" };

/**
 * Deliberately NOT under /app. The /app layout refuses to render anything until
 * consent exists, so a consent form living inside it could never be reached —
 * sign-up dead-ended on its own gate. This route needs auth but not consent.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  return (
    <div style={{ minHeight: "100dvh", padding: "2.5rem 1.25rem 4rem" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
