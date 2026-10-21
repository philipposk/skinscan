// True once Stripe is configured on this deployment. Until then the paid review is shown as
// "Coming soon" instead of a button that fails at checkout. Server-only: reads a secret's presence.
export const paymentsLive = (): boolean => Boolean(process.env.STRIPE_SECRET_KEY);
