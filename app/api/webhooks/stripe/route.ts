import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createTrustedClient } from "@/lib/supabase/trusted";
import { claimEvent, markProcessed, markFailed } from "@/lib/webhookClaim";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const trusted = createTrustedClient();

  const claim = await claimEvent(trusted, "stripe", event.id, event.type);
  if (claim === "already_processed") {
    return NextResponse.json({ received: true, deduped: true });
  }
  if (claim === "held_by_other") {
    return NextResponse.json({ received: true, retry: true }, { status: 409 });
  }
  if (claim === "error") {
    return NextResponse.json({ error: "Could not claim event." }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const chargeId =
          typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;

        let transferId: string | null = null;
        if (chargeId) {
          const charge = await stripe.charges.retrieve(chargeId);
          transferId = typeof charge.transfer === "string" ? charge.transfer : charge.transfer?.id ?? null;
        }

        const { data: tip } = await trusted
          .from("tips")
          .update({ status: "succeeded", stripe_charge_id: chargeId ?? null, stripe_transfer_id: transferId })
          .eq("stripe_payment_intent_id", pi.id)
          .select("id, creator_id, creator_net_cents")
          .single();

        // C8 fix: reads the immutable creator_net_cents stored at tip
        // creation (app/api/tips/route.ts), not a recalculation from
        // whatever PLATFORM_TAKE_RATE happens to be right now.
        if (tip && tip.creator_net_cents != null) {
          const { error: ledgerError } = await trusted.from("ledger_entries").insert({
            creator_id: tip.creator_id,
            tip_id: tip.id,
            amount_cents: tip.creator_net_cents,
            entry_type: "tip_credit",
          });
          if (ledgerError && ledgerError.code !== "23505") throw ledgerError;
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await trusted.from("tips").update({ status: "failed" }).eq("stripe_payment_intent_id", pi.id);
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId =
          typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;

        if (paymentIntentId) {
          const { data: tip } = await trusted
            .from("tips")
            .update({ status: "disputed", dispute_status: "open" })
            .eq("stripe_payment_intent_id", paymentIntentId)
            .select("id, creator_id, creator_net_cents, stripe_transfer_id")
            .single();

          if (tip && tip.creator_net_cents != null && tip.stripe_transfer_id) {
            let reversalId: string | null = null;
            try {
              // C7 fix: idempotency key based on the Stripe event id —
              // if this handler somehow runs twice for the same
              // dispute, Stripe returns the SAME reversal object
              // instead of creating a second one.
              const reversal = await stripe.transfers.createReversal(
                tip.stripe_transfer_id,
                { amount: tip.creator_net_cents },
                { idempotencyKey: `reversal_${event.id}` }
              );
              reversalId = reversal.id;
            } catch (reversalError) {
              console.error("Transfer reversal failed", reversalError);
              throw reversalError;
            }

            await trusted.from("tips").update({ stripe_reversal_id: reversalId }).eq("id", tip.id);

            const { error: ledgerError } = await trusted.from("ledger_entries").insert({
              creator_id: tip.creator_id,
              tip_id: tip.id,
              amount_cents: -tip.creator_net_cents,
              entry_type: "dispute_hold",
            });
            if (ledgerError && ledgerError.code !== "23505") throw ledgerError;
          }
        }
        break;
      }

      // C8 fix: Round 3 handled dispute CREATION only. This is the
      // missing resolution path — Stripe fires charge.dispute.closed
      // with a final status of won/lost.
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId =
          typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;

        if (paymentIntentId) {
          const won = dispute.status === "won";
          const { data: tip } = await trusted
            .from("tips")
            .update({
              status: won ? "succeeded" : "disputed",
              dispute_status: won ? "won" : "lost",
            })
            .eq("stripe_payment_intent_id", paymentIntentId)
            .select("id, creator_id, creator_net_cents, stripe_transfer_id")
            .single();

          if (won && tip && tip.creator_net_cents != null && tip.stripe_transfer_id) {
            // Won: the original reversal (at dispute-creation time)
            // pulled funds from the connected account into the
            // platform balance. Re-crediting the creator needs a FRESH
            // forward transfer — createReversal only pulls funds back,
            // it can't push them forward again.
            const { data: payoutAccount } = await trusted
              .from("creator_payout_accounts")
              .select("stripe_account_id")
              .eq("user_id", tip.creator_id)
              .single();

            if (payoutAccount?.stripe_account_id) {
              try {
                await stripe.transfers.create(
                  {
                    amount: tip.creator_net_cents,
                    currency: "aud",
                    destination: payoutAccount.stripe_account_id,
                  },
                  { idempotencyKey: `dispute_won_transfer_${event.id}` }
                );
              } catch (transferError) {
                console.error("Dispute-won re-transfer failed", transferError);
                throw transferError;
              }
            } else {
              console.error("No payout account found for dispute-won re-transfer, tip", tip.id);
            }

            const { error: ledgerError } = await trusted.from("ledger_entries").insert({
              creator_id: tip.creator_id,
              tip_id: tip.id,
              amount_cents: tip.creator_net_cents,
              entry_type: "dispute_release",
            });
            if (ledgerError && ledgerError.code !== "23505") throw ledgerError;
          }
          // Lost: the dispute_hold entry from creation-time already
          // reflects the funds being unavailable — the hold simply
          // becomes permanent, no further ledger action needed.
        }
        break;
      }

      // C8 fix: refunds weren't handled at all in Round 3.
      // C10 fix (Round 5 audit): Round 4 assumed any charge.refunded
      // event meant "the whole tip is refunded" and debited the full
      // creator_net_cents regardless of how much was actually refunded.
      // Stripe's `charge.refunded` payload includes the full list of
      // refunds on the charge — this reconciles against the SPECIFIC
      // refund object(s), so it correctly handles partial refunds and
      // also correctly reconciles refunds created out-of-band (Stripe
      // Dashboard) that didn't go through GTAHUB's own /api/tips/[id]/refund.
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;

        const { data: tip } = await trusted
          .from("tips")
          .select("id, creator_id, amount_cents, creator_net_cents, cumulative_refunded_cents")
          .eq("stripe_charge_id", charge.id)
          .single();

        if (!tip || tip.creator_net_cents == null) break;

        const refundsList = charge.refunds?.data ?? [];
        // Note: Stripe's charge object includes only the first page of
        // refunds by default (typically up to 10). A charge refunded
        // more than that many times would need `stripe.refunds.list()`
        // with pagination here instead — acceptable for a tips product
        // where that volume of partial refunds on one tip is not a
        // realistic case, but worth knowing if that assumption changes.

        for (const stripeRefund of refundsList) {
          if (stripeRefund.status !== "succeeded") continue;

          // Reconcile: does GTAHUB already have a row for this specific
          // Stripe refund id? If a refund was created through
          // /api/tips/[id]/refund, the row exists as 'pending' and just
          // needs its recovery status confirmed. If it was created
          // out-of-band (Dashboard), no row exists yet — create one now
          // so out-of-band refunds are still tracked and accounted for.
          const { data: existingRefund } = await trusted
            .from("tip_refunds")
            .select("id, status")
            .eq("stripe_refund_id", stripeRefund.id)
            .single();

          let tipRefundId: string;
          let creatorRecoverCents: number;

          if (existingRefund) {
            if (existingRefund.status === "recovered") continue; // already reconciled, skip
            tipRefundId = existingRefund.id;
            creatorRecoverCents = Math.round(
              ((stripeRefund.amount ?? 0) / tip.amount_cents) * tip.creator_net_cents
            );
          } else {
            creatorRecoverCents = Math.round(
              ((stripeRefund.amount ?? 0) / tip.amount_cents) * tip.creator_net_cents
            );
            const { data: inserted, error: insertErr } = await trusted
              .from("tip_refunds")
              .insert({
                tip_id: tip.id,
                stripe_refund_id: stripeRefund.id,
                gross_refund_cents: stripeRefund.amount ?? 0,
                creator_recovered_cents: creatorRecoverCents,
                status: "pending",
              })
              .select("id")
              .single();
            if (insertErr || !inserted) continue;
            tipRefundId = inserted.id;
          }

          await trusted
            .from("tip_refunds")
            .update({ status: "recovered" })
            .eq("id", tipRefundId);

          const { error: ledgerError } = await trusted.from("ledger_entries").insert({
            creator_id: tip.creator_id,
            tip_id: tip.id,
            tip_refund_id: tipRefundId,
            amount_cents: -creatorRecoverCents,
            entry_type: "refund_debit",
          });
          if (ledgerError && ledgerError.code !== "23505") throw ledgerError;
        }

        // Recompute cumulative refunded from the authoritative Stripe
        // charge object rather than incrementing locally — avoids drift
        // if this handler is ever retried or events arrive out of order.
        const newCumulative = charge.amount_refunded ?? 0;
        const isFullyRefunded = newCumulative >= tip.amount_cents;

        await trusted
          .from("tips")
          .update({
            cumulative_refunded_cents: newCumulative,
            status: isFullyRefunded ? "refunded" : "partially_refunded",
          })
          .eq("id", tip.id);

        break;
      }

      default:
        break;
    }

    await markProcessed(trusted, "stripe", event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    await markFailed(trusted, "stripe", event.id, err instanceof Error ? err.message : String(err));
    console.error("Stripe webhook processing failed", err);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
