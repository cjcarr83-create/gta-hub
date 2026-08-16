# GTAHUB — Admin, Verification & GTA VI Launch Hub

New this round, built on top of Round 5.

## Admin console (`/admin`)

- **Gated server-side**, not just hidden in the UI — a non-admin hitting
  `/admin` gets a real 404. Every admin API route independently
  re-checks admin status too (defense in depth).
- Admin status lives in `admin_users`, a table with **zero client RLS
  policies** — not even SELECT. No client-side trick can read or spoof
  it; only the trusted server client ever queries it.
- **Bootstrap:** there's no safe way for the first admin to grant
  themselves through the app (that would let anyone self-promote). Run
  this once in the Supabase SQL editor after finding your user id in
  `auth.users`:
  ```sql
  insert into public.admin_users (user_id, note)
  values ('YOUR-USER-UUID-HERE', 'platform owner, bootstrap');
  ```
- **User moderation:** search by username, verify/unverify, and set
  account state (active/restricted/suspended/banned). Every action
  writes to `moderation_actions` — a permanent audit log. The affected
  user can see actions taken against their own account; nothing else is
  exposed to any client.

## Verification badges

- `profiles.is_verified` — trusted-only column (same REVOKE/GRANT
  pattern used everywhere else in this project), settable only through
  `/api/admin/verify`.
- `VerifiedBadge` component — an original blue-checkmark design, not a
  copy of any specific platform's icon asset. Shown next to usernames on
  video cards and profile pages.

## YouTube integration

- **Embeds, not re-hosting.** `youtube_embeds` stores only metadata
  (video id, title, channel, thumbnail) pulled via the official YouTube
  Data API v3. Playback happens entirely through YouTube's own
  `youtube-nocookie.com` embedded player — this is the same mechanism as
  any website linking to a YouTube video, not redistribution of the
  video file itself.
- Admin-triggered sync (`/api/admin/youtube-sync`) — searches YouTube
  for a given term (defaults to GTA VI content), stores results,
  skips duplicates automatically.
- `YouTubeEmbed` component uses the "lite embed" pattern — a thumbnail +
  play button, with the actual (heavier) iframe only loading on click.

## GTA VI Launch Hub (`/launch-hub`)

- Countdown to **November 19, 2026** — Rockstar/Take-Two's most
  recently confirmed release date, verified via search against current
  news (as recently as last month) rather than assumed from training
  data. Framed honestly as "most recently confirmed," not a guarantee,
  since dates for unreleased games can still move.
- Curated YouTube trailer/news section (admin-curated via the sync tool)
- Trending native community clips section
- Linked from a promo banner on the main feed

## New environment variable

```
YOUTUBE_API_KEY=
```
From console.cloud.google.com — enable "YouTube Data API v3" on a
project, create an API key. Only used server-side, in the admin sync
route.

## Verified this round

```
npm install       # clean, 0 vulnerabilities
npx tsc --noEmit   # zero errors
npx eslint .       # 1 pre-existing unrelated warning, 0 errors
npm run build      # compiles clean; only failure is Google Fonts
                    # unreachable from this sandbox, not a code defect
```

## Further upgrade ideas (not built this round — for later)

A few directions worth considering next, roughly in order of
leverage-to-effort:

- **Push notifications** for "someone you follow went live" / "your
  clip got tipped" — high engagement value, moderate build (web push +
  a notifications table).
- **Launch-day live hub** — when November 19 actually arrives, a pinned
  aggregation view of first-impressions clips and live reactions across
  the whole platform. Cheap to build once Discover/ranking exists.
- **Creator leaderboards** — weekly top-tipped, most-viewed, by crew —
  reuses data that already exists (tips, view_count), mostly a
  read-only query + UI page.
- **Report/flag button** on clips and profiles, feeding into the
  `moderation_actions` audit trail already built this round — natural
  next step now that the admin console exists to act on reports.
- **Search** — currently there's no way to find a specific clip, crew,
  or creator by keyword. High value, needs Postgres full-text search or
  a dedicated search index depending on scale.
- The larger deferred items from Rounds 1–5 (H14–H22, the full social/
  Discover feed, automated tests) remain the highest-leverage work
  before real launch traffic — this round intentionally focused on the
  specific features requested rather than continuing that backlog.
