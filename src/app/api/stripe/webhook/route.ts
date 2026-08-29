import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Payment confirmation. This is the only place a case becomes `paid` — the
 * browser returning to the success URL proves nothing.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const raw = await req.text();
  const stripe = new Stripe(secret);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature check failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const caseId = session.metadata?.case_id;
    if (caseId) {
      const admin = createAdminClient();
      await admin
        .from("skinscan_cases")
        .update({
          status: "paid",
          submitted_at: new Date().toISOString(),
          stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
        })
        .eq("id", caseId)
        .eq("status", "awaiting_payment");

      await admin.from("skinscan_audit").insert({
        action: "case_paid",
        case_id: caseId,
        subject_user_id: session.metadata?.user_id ?? null,
        meta: { amount_total: session.amount_total, currency: session.currency },
      });
    }
  }

  return NextResponse.json({ received: true });
}
