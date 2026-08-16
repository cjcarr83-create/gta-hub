import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
});

const PLATFORM_TAKE_RATE = 0.1;
const MAX_TIP_CENTS = 50_000;
const TIP_VELOCITY_WINDOW_MINUTES = 60;
const TIP_VELOCITY_MAX_COUNT = 20;

// H3 fix (Round 2 audit): Round 1 trusted whatever `creatorId` +
// `videoId`/`streamId` the client sent, with no proof the content
// actually belonged to that creator, and no rejection of an ambiguous
// "both video and stream set" payload before a PaymentIntent was
// already created. Fixed by validating the full shape first, then
// looking up the target row and confirming its owner matches
// `creatorId` server-side before any Stripe call.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to send a tip." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { creatorId, videoId, streamId, amountCents, message, tipRequestId } = body as {
    creatorId?: unknown;
    videoId?: unknown;
    streamId?: unknown;
    amountCents?: unknown;
    message?: unknown;
    tipRequestId?: unknown;
  };

  // --- schema validation, before any DB or Stripe call ---
  if (typeof creatorId !== "string" || !creatorId) {
    return NextResponse.json({ error: "Missing creator." }, { status: 400 });
  }
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }
  if (amountCents > MAX_TIP_CENTS) {
    return NextResponse.json({ error: "Amount exceeds the per-tip limit." }, { status: 400 });
  }
  if (videoId !== undefined && typeof videoId !== "string") {
    return NextResponse.json({ error: "Invalid video reference." }, { status: 400 });
  }
  if (streamId !== undefined && typeof streamId !== "string") {
    return NextResponse.json({ error: "Invalid stream reference." }, { status: 400 });
  }
  if (videoId && streamId) {
    return NextResponse.json(
      { error: "A tip can target a video or a stream, not both." },
      { status: 400 }
    );
  }
  if (message !== undefined && (typeof message !== "string" || message.length > 200)) {
    return NextResponse.json({ error: "Message too long." }, { status: 400 });
  }
  if (creatorId === user.id) {
    return NextResponse.json({ error: "You can't tip yourself." }, { status: 400 });
  }
  // M12 fix (Round 3 audit): without an idempotency key, a network
  // failure/retry between the client and this route could create two
  // separate PaymentIntents for what the person experienced as one tip
  // attempt. The client generates a fresh id per tip attempt (see
  // TipSheet.tsx) and Stripe dedupes on it — a retried request with the
  // same key returns the original PaymentIntent instead of creating a
  // second one.
  if (typeof tipRequestId !== "string" || tipRequestId.length < 8) {
    return NextResponse.json({ error: "Missing request id." }, { status: 400 });
  }

  const trusted = createTrustedClient();

  // --- target ownership check, before any Stripe call ---
  if (videoId) {
    const { data: video } = await trusted
      .from("videos")
      .select("user_id, is_public, moderation_status")
      .eq("id", videoId)
      .single();
    if (!video || video.user_id !== creatorId) {
      return NextResponse.json({ error: "That video doesn't belong to this creator." }, { status: 400 });
    }
    if (!video.is_public || video.moderation_status !== "visible") {
      return NextResponse.json({ error: "This content isn't available for tips." }, { status: 400 });
    }
  }
  if (streamId) {
    const { data: stream } = await trusted
      .from("streams")
      .select("user_id")
      .eq("id", streamId)
      .single();
    if (!stream || stream.user_id !== creatorId) {
      return NextResponse.json({ error: "That stream doesn't belong to this creator." }, { status: 400 });
    }
  }

  // --- velocity limit ---
  const windowStart = new Date(Date.now() - TIP_VELOCITY_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await trusted
    .from("tips")
    .select("id", { count: "exact", head: true })
    .eq("tipper_id", user.id)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= TIP_VELOCITY_MAX_COUNT) {
    return NextResponse.json(
      { error: "You're sending tips too quickly. Try again shortly." },
      { status: 429 }
    );
  }

  // --- creator payout readiness ---
  const { data: payoutAccount } = await trusted
    .from("creator_payout_accounts")
    .select("stripe_account_id, onboarding_status")
    .eq("user_id", creatorId)
    .single();

  if (!payoutAccount || payoutAccount.onboarding_status !== "complete") {
    return NextResponse.json({ error: "This creator hasn't set up payouts yet." }, { status: 400 });
  }

  const platformFeeCents = Math.round(amountCents * PLATFORM_TAKE_RATE);
  const creatorNetCents = amountCents - platformFeeCents;

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: "aud",
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: payoutAccount.stripe_account_id },
      metadata: {
        tipper_id: user.id,
        creator_id: creatorId,
        video_id: videoId ?? "",
        stream_id: streamId ?? "",
      },
    },
    { idempotencyKey: `tip_${user.id}_${tipRequestId}` }
  );

  const { error: insertError } = await trusted.from("tips").insert({
    tipper_id: user.id,
    creator_id: creatorId,
    video_id: videoId ?? null,
    stream_id: streamId ?? null,
    amount_cents: amountCents,
    platform_fee_cents: platformFeeCents,
    creator_net_cents: creatorNetCents,
    currency: "aud",
    message: typeof message === "string" ? message.slice(0, 200) : null,
    stripe_payment_intent_id: paymentIntent.id,
    status: "pending",
  });

  // unique(stripe_payment_intent_id): if Stripe's idempotency key
  // returned the SAME PaymentIntent as a prior attempt, the tips row
  // already exists from that attempt — expected, not an error.
  if (insertError && insertError.code !== "23505") {
    return NextResponse.json({ error: "Could not record tip." }, { status: 500 });
  }

  // C4 fix: previously the route's job ended here and the client treated
  // this response as "tip sent." Returning the PaymentIntent id
  // explicitly (not just clientSecret) so the client can surface it in
  // error states / support requests, on top of using clientSecret to
  // actually confirm payment via Stripe Elements (see TipSheet.tsx).
  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  });
}
