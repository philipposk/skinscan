import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { case_id } = (await req.json().catch(() => ({}))) as { case_id?: string };
  if (!case_id) return NextResponse.json({ error: "Missing case_id" }, { status: 400 });

  const { data: theCase } = await supabase
    .from("skinscan_cases")
    .select("id, human_ref, price_cents, currency, status")
    .eq("id", case_id)
    .maybeSingle();

  if (!theCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (theCase.status !== "awaiting_payment" && theCase.status !== "draft") {
    return NextResponse.json({ error: "This case has already been paid for" }, { status: 409 });
  }

  const stripe = new Stripe(secret);
  const origin = new URL(req.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: theCase.currency,
          unit_amount: theCase.price_cents,
          product_data: {
            name: "Dermatologist review",
            description: `Written opinion from a licensed dermatologist within 48 hours. Case ${theCase.human_ref}.`,
          },
        },
      },
    ],
    // The webhook is the only thing that marks a case paid, so this id has to
    // survive the round trip.
    metadata: { case_id: theCase.id, user_id: user.id },
    success_url: `${origin}/app/cases/${theCase.id}?paid=1`,
    cancel_url: `${origin}/app/cases/${theCase.id}?cancelled=1`,
  });

  await supabase.from("skinscan_cases").update({ stripe_session_id: session.id }).eq("id", theCase.id);

  return NextResponse.json({ url: session.url });
}
