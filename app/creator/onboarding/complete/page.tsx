import Stripe from "stripe";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
});

// Stripe redirects here after the hosted onboarding flow, regardless of
// whether the creator actually finished it. This checks the account's
// real status server-side rather than trusting that "they got
// redirected here" means "onboarding succeeded" — a creator can bail
// out partway and Stripe still sends them back to return_url.
export default async function OnboardingCompletePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <main className="px-4 pt-6 text-sand-muted">Sign in to check your status.</main>;
  }

  const trusted = createTrustedClient();

  const { data: payoutAccount } = await trusted
    .from("creator_payout_accounts")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .single();

  if (!payoutAccount) {
    return (
      <main className="px-4 pt-6">
        <div className="card text-center text-sand-muted">
          No onboarding in progress.{" "}
          <Link href="/creator/onboarding" className="text-sunset-amber">
            Start here
          </Link>
          .
        </div>
      </main>
    );
  }

  const account = await stripe.accounts.retrieve(payoutAccount.stripe_account_id);
  const isComplete = account.details_submitted && account.charges_enabled;

  await trusted
    .from("creator_payout_accounts")
    .update({ onboarding_status: isComplete ? "complete" : "pending" })
    .eq("user_id", user.id);

  return (
    <main className="px-4 pt-6">
      <div className="card text-center">
        {isComplete ? (
          <>
            <p className="mb-3 text-lg text-palm-teal">You&apos;re tip-ready</p>
            <p className="text-sm text-sand-muted">
              Payouts are set up. Tips on your clips and streams will now go through.
            </p>
          </>
        ) : (
          <>
            <p className="mb-3 text-lg text-sunset-amber">Not quite finished</p>
            <p className="mb-4 text-sm text-sand-muted">
              Stripe still needs a bit more information before payouts can start.
            </p>
            <Link href="/creator/onboarding" className="btn-primary inline-block">
              Finish setup
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
