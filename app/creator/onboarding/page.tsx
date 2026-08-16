"use client";

import { useState } from "react";

export default function CreatorOnboardingPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleStart() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/creator/onboarding", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not start onboarding.");
      }
      const { url } = await res.json();
      window.location.href = url; // Stripe-hosted onboarding, off-app
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-6 text-2xl">Set up payouts</h1>
      <div className="card space-y-4">
        <p className="text-sm text-sand-muted">
          GTAHUB uses Stripe to pay creators — your bank details and identity
          verification happen on Stripe&apos;s own secure page, not in this app.
          Takes a few minutes.
        </p>
        {errorMsg && <p className="text-sm text-blood">{errorMsg}</p>}
        <button
          onClick={handleStart}
          disabled={status === "loading"}
          className="btn-primary w-full disabled:opacity-50"
        >
          {status === "loading" ? "Redirecting…" : "Continue to Stripe"}
        </button>
      </div>
    </main>
  );
}
