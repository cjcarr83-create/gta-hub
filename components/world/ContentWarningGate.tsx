"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// This is a real gate, not a decorative interstitial: it stays up
// until the checkbox is actively checked AND the button pressed, and
// the acknowledgment is written to profiles.violence_ack_at (see
// migration 0004) rather than just remembered in localStorage — an
// account-level, timestamped record instead of a per-device dismiss
// that proves nothing if someone clears their browser or signs in
// somewhere new.
//
// Said plainly, because overstating this would be worse than saying
// nothing: this is self-attestation, not age verification. A checkbox
// cannot confirm who's actually on the other end of the screen. It's
// the right amount of ceremony for a small app among people who know
// each other; it stops being the right amount the moment this is
// opened up more broadly, at which point real verification is a legal
// question, not just a product one. See ROUND9_CHANGELOG.md.
export default function ContentWarningGate({
  userId,
  onAcknowledged,
}: {
  userId: string;
  onAcknowledged: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleEnter() {
    if (!checked) return;
    setSubmitting(true);
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ violence_ack_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      setErrorMsg("Couldn't save that — try again.");
      setSubmitting(false);
      return;
    }
    onAcknowledged();
  }

  return (
    <main className="flex min-h-[70vh] items-center px-4">
      <div className="card w-full">
        <h1 className="mb-2 text-xl text-blood">Before you enter The Block</h1>
        <p className="mb-3 text-sm text-sand-muted">
          The Block includes simulated weapons and blood effects as part
          of its combat game. It&apos;s fictional and cartoonish in
          design, not realistic gore, but it is more intense than the
          rest of GTAHUB.
        </p>
        <p className="mb-4 text-sm text-sand-muted">
          By continuing, you&apos;re confirming you&apos;re comfortable
          with this kind of content and old enough to view it under
          your local laws.
        </p>

        <label className="mb-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5"
          />
          <span>I understand and want to continue.</span>
        </label>

        {errorMsg && <p className="mb-3 text-sm text-blood">{errorMsg}</p>}

        <button
          onClick={handleEnter}
          disabled={!checked || submitting}
          className="btn-primary w-full disabled:opacity-40"
        >
          {submitting ? "One sec…" : "Enter The Block"}
        </button>
      </div>
    </main>
  );
}
