# GTAHUB Round 5 — Changelog

Fixes against `GTAHUB_V2_ROUND5_PLUS_VANTRA_STUDIOS_CLAUDE_HANDOFF.zip`.
The Round 4 scaffold in that package was verified byte-identical to what
was actually delivered before this round started.

Scope this round: the two Critical findings (C10, C11), matching the
audit's own recommended order (items 1–2). H14–H22 and M23–M24 are
listed as deferred at the bottom, not silently dropped.

---

## C10 — Refund handling was financially incorrect

**Files changed:**
- `supabase/migrations/0001_init.sql` — new `tip_refunds` table, `tips.cumulative_refunded_cents`, new `partially_refunded` status, split ledger idempotency (see below)
- `app/api/tips/[id]/refund/route.ts` — new. GTAHUB's own trusted refund API
- `app/api/webhooks/stripe/route.ts` — `charge.refunded` handler rewritten

**What was actually wrong (confirmed against Stripe's own Connect docs
via web search before fixing):** a destination-charge refund does
**not** automatically reverse the connected account's transfer — the
platform is left covering the negative balance unless the refund is
created with `reverse_transfer: true`. Round 4 had no refund-creation
path at all, and its `charge.refunded` handler assumed any such event
meant the whole tip was refunded, debiting the full `creator_net_cents`
regardless of actual refund size.

**Fix:**
- New trusted route creates Stripe refunds with `reverse_transfer: true`
  and `refund_application_fee: true` — this is the actual fund-recovery
  fix, not just accounting bookkeeping
- Supports partial refunds: creator debit is computed proportionally
  (`refundAmount / tip.amount_cents × creator_net_cents`), not assumed
  to be the full net amount
- `tip_refunds` tracks each Stripe refund object individually, so the
  webhook can reconcile refunds created out-of-band (Stripe Dashboard)
  in addition to ones created through GTAHUB's own API
- A tip is only marked fully `refunded` once `cumulative_refunded_cents
  >= amount_cents`; otherwise it's `partially_refunded`
- Ledger idempotency for `refund_debit` now keys on the specific
  `tip_refund_id` (via a partial unique index), not `(tip_id,
  entry_type)` — necessary because a tip can now legitimately have
  multiple refund_debit entries

**Verification:** `npx tsc --noEmit` clean, `npx eslint .` clean (1
pre-existing unrelated warning). Not verified against a live Stripe test
account in this session — no live keys available; verify with Stripe
CLI's `stripe trigger charge.refunded` and a manual partial-refund test
before trusting this in production.

---

## C11 — Video delete could still orphan Mux resources

**File changed:** `app/api/videos/[id]/route.ts` — rewritten

**What was actually wrong:** the Round 4 version caught *any* exception
from `mux.video.assets.delete()` and deleted the GTAHUB row anyway — a
transient network blip produced exactly the orphaning condition the
route was supposed to prevent. It also never handled the case where a
video is still mid-upload (no `mux_asset_id` yet, only a pending Direct
Upload) — that upload was never cancelled, so it could complete *after*
the GTAHUB row was deleted and create an asset with no tracking row at all.

**Fix (Mux SDK methods verified against the actually-installed package's
`.d.ts` before use, not assumed):**
- `mux.video.uploads.cancel()` confirmed to exist and do exactly what's
  needed — cancels a pending Direct Upload so a late completion can't
  create an orphaned asset
- `Mux.NotFoundError` confirmed as the real exception class for a 404 —
  used to distinguish "already gone, fine" from "unknown failure, block
  deletion"
- Route now selects both `mux_asset_id` and `mux_upload_id`, and routes
  to asset-delete or upload-cancel accordingly
- An unknown/transient failure now returns `503` and does **not** delete
  the DB row — the actual C11 fix. Only a confirmed-gone (404) or
  confirmed-cancelled resource allows the DB row to be removed
- Row is marked unavailable (`processing_status: 'failed'`, `is_public:
  false`) before cleanup starts, so a Mux webhook firing mid-deletion
  has a signal not to revive it — a partial mitigation, not the full
  "deletion state + matching webhook handling" the audit recommended
  (see deferred items)

**Verification:** `npx tsc --noEmit` clean. Manual read-through only for
the Mux API surface (verified against installed `.d.ts` files, not a
live Mux account — no live keys available this session).

---

## M16 (carried forward, unaffected)

No changes this round — Round 4's ESLint fix remains verified working
(`npx eslint .` still runs clean).

---

## Deferred this round — explicit, not silently dropped

Per the audit's own priority order, items 3–9 stay open:

- **H14** — live-stream lifecycle vs. reusable Mux stream keys. The
  audit's own recommendation (reusable broadcaster channel + per-
  broadcast `live_sessions` rows, DB-enforced uniqueness) is a real
  schema/architecture decision, not a quick patch — needs its own pass.
- **H15** — view/viewer counting is still spoofable via client-supplied
  session IDs. Real fix needs either signed server-issued viewer tokens
  or Mux's engagement/monitoring data as the source of truth.
- **H16** — no `account.updated` webhook handler; Stripe Connect status
  can go stale after onboarding.
- **H17** — connected-account creation isn't concurrency-safe.
- **H18** — account state isn't consistently enforced on UPDATE across
  videos/streams/garage builds/crews.
- **H19** — `profiles.crew_id` is still directly client-writable,
  bypassing "closed" recruitment status.
- **H20** — request validation still relies on TypeScript casts rather
  than a runtime schema library.
- **H21/H22/M23** — dispute-won ledger/transfer sequencing, upload
  rate-limiter fail-open behavior, and webhook retry-metadata gaps all
  remain from the Round 4 README's own honest accounting.
- **M24** — no automated test suite. This remains the largest process
  gap across all five rounds.
- The full social/Discover/premium-UI product layer remains out of
  scope, consistent with every previous round's reasoning.
