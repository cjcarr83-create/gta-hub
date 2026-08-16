import { createTrustedClient } from "@/lib/supabase/trusted";

const STALE_LOCK_MINUTES = 5;

type TrustedClient = ReturnType<typeof createTrustedClient>;

// C7 fix (Round 4 audit): shared by both webhook routes so the atomic-
// claim logic exists in exactly one place. See the long comment history
// in git/PR review for why this exists — short version: a journal row
// merely existing with status='processing' isn't an exclusive claim,
// because a second concurrent delivery can read that same status and
// proceed anyway. This claims the row via a conditional UPDATE, which
// Postgres serializes at the row level, so only one concurrent request
// can ever win it for a given (provider, provider_event_id).
export async function claimEvent(
  trusted: TrustedClient,
  provider: "stripe" | "mux",
  eventId: string,
  eventType: string
): Promise<"claimed" | "already_processed" | "held_by_other" | "error"> {
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MINUTES * 60_000).toISOString();

  const { error: insertError } = await trusted.from("webhook_events").insert({
    provider,
    provider_event_id: eventId,
    event_type: eventType,
    status: "processing",
    locked_at: new Date().toISOString(),
    attempt_count: 1,
  });

  if (!insertError) return "claimed";
  if (insertError.code !== "23505") return "error";

  const { data: claimed, error: claimError } = await trusted
    .from("webhook_events")
    .update({
      status: "processing",
      locked_at: new Date().toISOString(),
      // attempt_count isn't incremented here — see note in
      // 0001_init.sql; a real atomic increment needs a SQL RPC function.
    })
    .eq("provider", provider)
    .eq("provider_event_id", eventId)
    .neq("status", "processed")
    .or(`status.eq.failed,locked_at.lt.${staleThreshold}`)
    .select("id")
    .maybeSingle();

  if (claimError) return "error";
  if (claimed) return "claimed";

  const { data: existing } = await trusted
    .from("webhook_events")
    .select("status")
    .eq("provider", provider)
    .eq("provider_event_id", eventId)
    .single();

  return existing?.status === "processed" ? "already_processed" : "held_by_other";
}

export async function markProcessed(trusted: TrustedClient, provider: "stripe" | "mux", eventId: string) {
  const { error } = await trusted
    .from("webhook_events")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("provider_event_id", eventId);
  // M17 fix: check this write instead of assuming it succeeded before
  // returning 2xx to the provider.
  if (error) {
    console.error("Failed to mark webhook event processed", provider, eventId, error);
    throw error;
  }
}

export async function markFailed(
  trusted: TrustedClient,
  provider: "stripe" | "mux",
  eventId: string,
  errorMessage: string
) {
  await trusted
    .from("webhook_events")
    .update({ status: "failed", last_error: errorMessage.slice(0, 500) })
    .eq("provider", provider)
    .eq("provider_event_id", eventId);
}
