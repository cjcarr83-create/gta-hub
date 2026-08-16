import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
});

// C10 fix (Round 5 audit): Round 4 had no trusted refund API at all —
// refunds could only be created out-of-band (Stripe Dashboard) and the
// webhook handler assumed the entire tip was refunded whenever any
// charge.refunded event arrived. This route is GTAHUB's own refund
// entry point, and it's the piece that actually reverses the connected
// account's transfer — confirmed against Stripe's Connect docs that a
// destination-charge refund does NOT do this automatically; the
// platform is left covering the negative balance unless the refund is
// created with reverse_transfer: true.
//
// Only creators/admins should call this in a real deployment — this
// scaffold checks that the caller is the tip's creator (a "give the
// tipper their money back" self-service action); extend with an
// admin-role check for support-initiated refunds.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tipId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { amountCents, refundRequestId } = body as { amountCents?: unknown; refundRequestId?: unknown };

  if (typeof refundRequestId !== "string" || refundRequestId.length < 8) {
    return NextResponse.json({ error: "Missing request id." }, { status: 400 });
  }
  if (amountCents !== undefined && (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents <= 0)) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }

  const trusted = createTrustedClient();

  const { data: tip } = await trusted
    .from("tips")
    .select("id, creator_id, amount_cents, creator_net_cents, cumulative_refunded_cents, stripe_payment_intent_id, stripe_transfer_id, status")
    .eq("id", tipId)
    .single();

  if (!tip) {
    return NextResponse.json({ error: "Tip not found." }, { status: 404 });
  }
  if (tip.creator_id !== user.id) {
    return NextResponse.json({ error: "Not authorized to refund this tip." }, { status: 403 });
  }
  if (tip.status !== "succeeded" && tip.status !== "partially_refunded") {
    return NextResponse.json({ error: "This tip isn't in a refundable state." }, { status: 400 });
  }
  if (!tip.stripe_payment_intent_id || tip.creator_net_cents == null) {
    return NextResponse.json({ error: "Tip is missing payment data." }, { status: 400 });
  }

  const remainingRefundable = tip.amount_cents - tip.cumulative_refunded_cents;
  const refundAmount = amountCents ?? remainingRefundable; // default: full remaining amount

  if (refundAmount > remainingRefundable) {
    return NextResponse.json({ error: "Refund amount exceeds what's left to refund." }, { status: 400 });
  }

  // Proportional creator debit: if this refund is (say) 40% of the
  // original charge, the creator's recovery amount is 40% of their net,
  // not the full net amount regardless of refund size — this is exactly
  // the C10 finding.
  const creatorRecoverCents = Math.round((refundAmount / tip.amount_cents) * tip.creator_net_cents);

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: tip.stripe_payment_intent_id,
        amount: refundAmount,
        reverse_transfer: true, // the actual C10 fix — without this, funds stay on the connected account
        refund_application_fee: true, // also return GTAHUB's platform fee on the refunded portion
      },
      { idempotencyKey: `refund_${tipId}_${refundRequestId}` }
    );
  } catch (err) {
    console.error("Stripe refund creation failed", err);
    return NextResponse.json({ error: "Refund could not be created." }, { status: 500 });
  }

  const { error: refundInsertError } = await trusted.from("tip_refunds").insert({
    tip_id: tipId,
    stripe_refund_id: refund.id,
    gross_refund_cents: refundAmount,
    creator_recovered_cents: creatorRecoverCents,
    status: "pending", // flipped to recovered/recovery_failed by the webhook once Stripe confirms
  });

  if (refundInsertError && refundInsertError.code !== "23505") {
    // Refund was created on Stripe's side but we couldn't record it —
    // this needs manual reconciliation, logged rather than silently lost.
    console.error("Refund succeeded on Stripe but DB insert failed", tipId, refund.id, refundInsertError);
    return NextResponse.json({ error: "Refund created but not recorded — contact support." }, { status: 500 });
  }

  return NextResponse.json({ refundId: refund.id, amountCents: refundAmount });
}
