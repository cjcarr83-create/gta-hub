// Round 12 security fix: the platform runs a legacy Stripe Connect
// "express" account flow (see app/api/creator/onboarding/route.ts) with no
// way to stop new money movement short of pulling the Stripe keys entirely
// (which would also break the refund route and webhook handling). This
// flag lets payments be switched off independently of those keys — e.g.
// during a Connect migration, a reconciliation issue, or a fraud spike.
// Defaults to enabled so deploying this doesn't silently disable live
// tipping — set PAYMENTS_ENABLED=false to trip the switch.
export function paymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED !== "false";
}
