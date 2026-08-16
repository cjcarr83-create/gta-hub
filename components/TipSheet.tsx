"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

const PRESET_AMOUNTS_CENTS = [200, 500, 1000, 2000];

// C4 fix (Round 2 audit): Round 1's tip sheet called /api/tips, received
// a PaymentIntent client secret, and immediately closed — no card was
// ever charged. That's the difference between "we started a payment"
// and "a tip was sent," and the UI presented the former as the latter.
//
// Fixed flow is now two real steps:
//   1. AmountStep — pick amount/message, POST /api/tips, get clientSecret
//   2. ConfirmStep — mount Stripe's PaymentElement against that secret
//      and actually call stripe.confirmPayment(). Only a genuine
//      'succeeded' result closes the sheet with a success state; the
//      webhook (app/api/webhooks/stripe) remains the authoritative
//      source of truth for the tip's final status regardless of what
//      the client-side confirmation call returns.
export default function TipSheet({
  creatorId,
  videoId,
  streamId,
  onClose,
}: {
  creatorId: string;
  videoId?: string;
  streamId?: string;
  onClose: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState(0);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Send a tip"
    >
      <div className="w-full rounded-t-lg border-t border-asphalt-line bg-asphalt-panel p-4 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg">Send a tip</h2>
          <button onClick={onClose} className="text-sand-muted hover:text-sand" aria-label="Close">
            ✕
          </button>
        </div>

        {!clientSecret ? (
          <AmountStep
            creatorId={creatorId}
            videoId={videoId}
            streamId={streamId}
            onIntentCreated={(secret, cents) => {
              setClientSecret(secret);
              setAmountCents(cents);
            }}
          />
        ) : (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: "night" } }}
          >
            <ConfirmStep amountCents={amountCents} onDone={onClose} />
          </Elements>
        )}
      </div>
    </div>
  );
}

function AmountStep({
  creatorId,
  videoId,
  streamId,
  onIntentCreated,
}: {
  creatorId: string;
  videoId?: string;
  streamId?: string;
  onIntentCreated: (clientSecret: string, amountCents: number) => void;
}) {
  const [amountCents, setAmountCents] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // M12 fix: generated once when this step mounts, not per click/retry —
  // a manual retry after a network error reuses the SAME key, which is
  // what makes Stripe's idempotency check actually work. Regenerating a
  // fresh id on every click would defeat the point entirely.
  const [tipRequestId] = useState(() => crypto.randomUUID());

  const effectiveAmount = customAmount ? Math.round(parseFloat(customAmount) * 100) : amountCents;

  async function handleContinue() {
    if (!effectiveAmount || effectiveAmount <= 0) {
      setErrorMsg("Enter an amount above $0.");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId,
          videoId,
          streamId,
          amountCents: effectiveAmount,
          message,
          tipRequestId,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? "Tip failed. Try again.");
      }

      const { clientSecret } = await res.json();
      onIntentCreated(clientSecret, effectiveAmount);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {PRESET_AMOUNTS_CENTS.map((cents) => (
          <button
            key={cents}
            onClick={() => {
              setAmountCents(cents);
              setCustomAmount("");
            }}
            className={`rounded border py-2 text-sm font-display
              ${amountCents === cents && !customAmount ? "border-sunset-amber text-sunset-amber" : "border-asphalt-line text-sand-muted"}`}
          >
            ${(cents / 100).toFixed(0)}
          </button>
        ))}
      </div>

      <input
        type="number"
        inputMode="decimal"
        placeholder="Custom amount"
        value={customAmount}
        onChange={(e) => setCustomAmount(e.target.value)}
        className="mb-3 w-full rounded border border-asphalt-line bg-asphalt px-3 py-2 text-sand"
      />

      <input
        type="text"
        placeholder="Add a message (optional)"
        maxLength={200}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="mb-4 w-full rounded border border-asphalt-line bg-asphalt px-3 py-2 text-sand"
      />

      {errorMsg && <p className="mb-3 text-sm text-blood">{errorMsg}</p>}

      <button
        onClick={handleContinue}
        disabled={status === "submitting"}
        className="btn-primary w-full disabled:opacity-50"
      >
        {status === "submitting" ? "Preparing…" : `Continue — $${(effectiveAmount / 100).toFixed(2)}`}
      </button>
    </div>
  );
}

function ConfirmStep({ amountCents, onDone }: { amountCents: number; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<"idle" | "confirming" | "succeeded" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setStatus("confirming");
    setErrorMsg("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message ?? "Payment failed.");
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      setStatus("succeeded");
      // The Stripe webhook is still the source of truth for the tip's
      // recorded status and ledger entry — this just confirms the
      // charge itself completed from the payer's side.
      setTimeout(onDone, 900);
    } else {
      setStatus("error");
      setErrorMsg("Payment did not complete.");
    }
  }

  if (status === "succeeded") {
    return (
      <div className="py-6 text-center">
        <p className="text-lg text-palm-teal">Tip sent — ${(amountCents / 100).toFixed(2)}</p>
      </div>
    );
  }

  return (
    <div>
      <PaymentElement />
      {errorMsg && <p className="mt-3 text-sm text-blood">{errorMsg}</p>}
      <button
        onClick={handleConfirm}
        disabled={!stripe || status === "confirming"}
        className="btn-primary mt-4 w-full disabled:opacity-50"
      >
        {status === "confirming" ? "Confirming…" : `Pay $${(amountCents / 100).toFixed(2)}`}
      </button>
    </div>
  );
}
