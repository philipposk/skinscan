// Paid reviews stay visible but can't be bought until payments are switched on. A Stripe key being
// present is not enough (production already has keys while checkout isn't set up), so this is an
// explicit build-time switch: set NEXT_PUBLIC_BILLING_ENABLED=true and redeploy to go live.
export const paymentsLive = (): boolean => process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";
