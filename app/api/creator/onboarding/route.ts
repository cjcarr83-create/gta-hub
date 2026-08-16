import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
});

// H11 fix (Round 3 audit): creator_payout_accounts existed in the schema
// and /api/tips already required onboarding_status = 'complete', but
// nothing in the app could ever get a creator TO 'complete' — there was
// no route to create a Stripe connected account or generate an
// onboarding link. Every creator was permanently tip-disabled.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const trusted = createTrustedClient();

  const { data: existing } = await trusted
    .from("creator_payout_accounts")
    .select("stripe_account_id, onboarding_status")
    .eq("user_id", user.id)
    .single();

  let stripeAccountId = existing?.stripe_account_id;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "AU",
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
    });
    stripeAccountId = account.id;

    await trusted.from("creator_payout_accounts").insert({
      user_id: user.id,
      stripe_account_id: stripeAccountId,
      onboarding_status: "pending",
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${appUrl}/creator/onboarding`, // link expired/abandoned — restart here
    return_url: `${appUrl}/creator/onboarding/complete`, // finished the Stripe-hosted flow
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
