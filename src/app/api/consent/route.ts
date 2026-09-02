import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.version || !Array.isArray(body.consents)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const required = ["health_data", "ai_processing", "terms"];
  const granted = new Set(
    body.consents.filter((c: { granted: boolean }) => c.granted).map((c: { kind: string }) => c.kind),
  );
  if (!required.every((r) => granted.has(r))) {
    return NextResponse.json({ error: "The three required consents must all be given." }, { status: 400 });
  }

  const h = await headers();
  // x-forwarded-for is a list; the client IP is the first entry.
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const ua = h.get("user-agent");

  // One immutable row per consent decision, so we can always show what was
  // agreed and when, which is what Article 7(1) actually requires.
  const { error: consentErr } = await supabase.from("skinscan_consents").insert(
    body.consents.map((c: { kind: string; granted: boolean }) => ({
      user_id: user.id,
      version: body.version,
      kind: c.kind,
      granted: c.granted,
      ip,
      user_agent: ua,
    })),
  );
  if (consentErr) return NextResponse.json({ error: consentErr.message }, { status: 500 });

  const p = body.profile ?? {};
  // Upsert, not update. Accounts that predate this app have no profile row, and
  // an update that matches nothing succeeds silently — which sent those users
  // straight back to the consent gate with nothing to show for it.
  const { error: profileErr } = await supabase
    .from("skinscan_profiles")
    .upsert({
      id: user.id,
      consent_version: body.version,
      consent_at: new Date().toISOString(),
      consent_ip: ip,
      year_of_birth: p.year_of_birth ?? null,
      sex_at_birth: p.sex_at_birth ?? null,
      fitzpatrick: p.fitzpatrick ?? null,
      personal_history_skin_cancer: !!p.personal_history_skin_cancer,
      family_history_melanoma: !!p.family_history_melanoma,
      immunosuppressed: !!p.immunosuppressed,
      many_moles: !!p.many_moles,
      history_of_sunburns: !!p.history_of_sunburns,
    });

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
