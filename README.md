# GTAHUB V2 — Round 5

This round fixed the two Critical findings from the Round 5 audit
(refund handling, video-delete resource cleanup) and added the Vantra
Studios brand integration layer. See:

- `ROUND5_CHANGELOG.md` — exact files changed per finding
- `ROUND5_TEST_RESULTS.md` — what was actually verified, and how
- `VANTRA_INTEGRATION_CHANGELOG.md` — brand integration details

A separate `vantra-site-integration/` package (outside this project
folder) contains the standalone Vantra Studios website component —
see that folder's own README.

## Setup

1. `npm install`
2. Push `supabase/migrations/0001_init.sql` to a Supabase project
3. Copy `.env.example` → `.env.local`, fill in Supabase/Mux/Stripe keys
   (now also includes `NEXT_PUBLIC_VANTRA_STUDIOS_URL`, optional —
   defaults to `https://vantrastudios.com`)
4. `npm run dev`

## Verified this round

```
npm install       # clean, 0 vulnerabilities
npx tsc --noEmit   # zero errors
npx eslint .       # 1 pre-existing unrelated warning, 0 errors
npm run build      # compiles clean; only failure is Google Fonts
                    # unreachable from this sandbox, not a code defect
```

No live Stripe or Mux keys were available this session, so the refund
flow (C10) and video-delete flow (C11) were verified by tracing the
code against the actual installed SDK type definitions and Stripe's
documented API behavior, not by running them against live test
accounts. Both fixes should be exercised against real test-mode
Stripe/Mux accounts before trusting them in production — specifics in
`ROUND5_TEST_RESULTS.md`.

## Still open

Full list in `ROUND5_CHANGELOG.md`'s "Deferred" section — highest
priority next: H14 (live-stream lifecycle redesign) and H15 (view/
viewer count abuse resistance), per the audit's own recommended order.
No automated test suite exists yet (M24) — this remains the largest
process gap across all five rounds.
