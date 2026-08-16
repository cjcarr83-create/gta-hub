# GTAHUB Round 5 — Test Results

Stated plainly: this is what was actually run and what its output was,
not a claim of full test coverage. There is still no automated test
suite (M24, open since Round 4) — everything below is manual
verification of the specific changes made this round.

## Commands actually run, in this environment

```
$ npm install
added N packages, audited N packages
0 vulnerabilities

$ npx tsc --noEmit
(no output — zero errors)

$ npx eslint .
/home/claude/gtahub-v2-r5/postcss.config.mjs
  1:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
✖ 1 problem (0 errors, 1 warning)

$ npm run build
▲ Next.js 16.3.0 (Turbopack)
Creating an optimized production build ...
Turbopack build encountered 2 warnings: [Google Fonts fetch — sandbox
network restriction, not a code defect. Confirmed by this being the
ONLY failure; no other build errors preceded or followed it.]
```

The lint warning is pre-existing (Round 4) and unrelated to this
round's changes — a stylistic ESLint rule about anonymous default
exports in a config file, not a bug.

## What was manually verified for C10 (refund handling)

- Confirmed Stripe's actual documented behavior via web search against
  `docs.stripe.com/connect/marketplace/tasks/refunds-disputes` before
  writing the fix: destination-charge refunds debit the platform by
  default; `reverse_transfer: true` is required to recover funds from
  the connected account. This is now set in `/api/tips/[id]/refund`.
- Traced the proportional-refund math by hand: a $10 tip with $6
  platform-fee-adjusted creator net, refunded 50% ($5), should debit
  the creator $3 (50% of $6) — confirmed the formula
  `Math.round((refundAmount / tip.amount_cents) * tip.creator_net_cents)`
  produces this.
- Confirmed the new partial-unique-index approach for ledger idempotency
  (`ledger_entries_refund_idx` on `tip_refund_id`) allows multiple
  `refund_debit` rows per tip while still preventing the same specific
  refund event from being double-processed.
- **Not verified:** an actual Stripe test-mode refund end-to-end (full
  or partial), because no live/test Stripe keys were available in this
  session. Before trusting this in production, run:
  ```
  stripe trigger charge.refunded
  ```
  against a real test-mode tip, and separately test a partial refund via
  the Stripe Dashboard on a test charge, confirming `tip_refunds` and
  `ledger_entries` end up in the expected state.

## What was manually verified for C11 (video deletion)

- Checked the actual installed `@mux/mux-node` package's `.d.ts` files
  (not assumed from memory) to confirm:
  - `mux.video.uploads.cancel(uploadId)` exists, with the documented
    behavior "only succeeds if the upload is still in the `waiting`
    state" — this shaped the `ConflictError` handling in the fix
  - `Mux.NotFoundError` exists as a distinct exported class with
    `status: 404`, usable for `instanceof` checks
- Traced the control flow by hand for four scenarios the audit
  specifically named:
  - **Upload still waiting:** `mux_asset_id` null, `mux_upload_id` set →
    routes to `tryCancelUpload` → succeeds → DB row deleted. Correct.
  - **Upload just completed (race):** `tryCancelUpload` hits Mux's 409
    (upload already transitioned) → caught as `ConflictError` → returns
    `false` → DB row is **not** deleted, 503 returned. Correct per the
    audit's required behavior — the row survives so a retry can find the
    now-populated `mux_asset_id` and take the asset-delete path instead.
  - **Asset exists:** routes to `tryDeleteAsset` → succeeds → DB row
    deleted. Correct.
  - **Provider delete temporarily fails (non-404, non-409):** falls into
    the generic `catch` → logged, returns `false` → DB row **not**
    deleted, 503 returned. This is the actual C11 fix — Round 4 deleted
    the row in this exact scenario.
- **Not verified:** an actual Mux API call in any of these states — no
  live Mux keys available this session. Before trusting this in
  production, test all four scenarios against a real Mux test
  environment, specifically the "upload just completed" race, which is
  timing-sensitive and hard to fully reason about from a static read.

## What was NOT touched or re-verified this round

- H14–H22, M23 (see `ROUND5_CHANGELOG.md` for the full list) — no new
  code, so no new verification needed or claimed.
- The Round 1–4 fixes were not re-tested this round; no changes were
  made to the files those rounds touched other than the specific lines
  listed in this changelog.
