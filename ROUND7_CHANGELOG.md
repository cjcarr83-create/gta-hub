# GTAHUB — AI Character Avatars & The Block (open world)

New this round, built on top of Round 6.

## AI character avatars (`/onboarding/avatar`)

- **Trait-picker only, never freeform text.** Skin tone, hair, outfit,
  accessory, and vibe are all fixed enums (`lib/avatarStyles.ts`). This
  is deliberate, not just simpler UI — it's the actual mitigation
  against two real risks: (1) copyright, since there's no code path
  where a client string can ask the image model to draw a specific
  copyrighted Rockstar character or a real person's likeness, and (2)
  prompt injection, since there's no "describe your character" field to
  smuggle instructions through.
- **Provider-agnostic.** `lib/avatarGen.ts` builds the actual prompt
  server-side from the validated trait tokens and calls
  `generateAvatarImage()` — deliberately left as a documented stub
  rather than hard-wiring a specific vendor (OpenAI Images, Replicate,
  Stability, etc). That's a cost/speed/licensing decision for whoever
  deploys this, not something to lock in silently. Set
  `AVATAR_PROVIDER_API_KEY` and implement the call once you've picked
  one; everything upstream (the route, the rate limit, the trait
  validation) won't need to change.
- **Trusted-only write path.** `app/api/profile/generate-avatar`
  follows the same shape as `create-upload-url` (Round 2, H1 fix):
  verify signed-in and active, rate-limit before spending provider
  quota (5/hour — image generation costs real money per call), then
  write `profiles.avatar_url`/`avatar_generation_status` via the
  trusted service-role client only. `avatar_generation_status` is a
  trusted-only column (same REVOKE/GRANT pattern as `is_verified`,
  Round 6) — `avatar_url` itself stays client-grantable for manual URL
  entry, same as before this round.
- `avatar_generations` is an insert-only audit log of every generation
  attempt (style requested, provider, result, error) — trusted-write
  only, same trust boundary as every other provider-integration table
  in this project.

## The Block (`/world`) — shared open world

- **2D, not 3D.** Avatars are AI-generated portrait images, not rigged
  3D models, so a 3D world would need a completely separate character
  pipeline to make any sense. Built as a top-down shared space instead
  — the right fit for what the avatars actually are.
- **Two Realtime primitives, two jobs.** Presence tracks who's in the
  room (roster, join/leave); Broadcast carries movement (~12 updates/
  sec) and chat bubbles. Neither touches Postgres — position is never
  persisted, which is what keeps a busy room cheap. See
  `lib/world/presence.ts` for the full reasoning.
- **Client-side interpolation** smooths the gap between broadcast
  updates so movement doesn't look like it's snapping between frames.
- **Two chat surfaces:** a live speech bubble over a player's head
  (pure broadcast, gone in 4 seconds, never stored) and a District tab
  with real scrollback (`world_chat_log`, publicly readable, RLS
  rate-limited to 5 messages/10sec per user directly in the INSERT
  policy — no separate attempts table needed here since, unlike
  `videos`, there's no client delete policy on this table for a user to
  exploit). A Nearby tab exists for proximity-scoped text without a
  scrollback (the live bubble on the canvas is the real "nearby chat"
  experience; this is a lightweight companion, not a full history).
- Gated at `/world`: signed in, `account_state = 'active'`, and an
  avatar set — no avatar redirects to the trait picker instead of
  rendering a blank circle.

## Bugs caught and fixed while building this round

- `lib/avatarGen.ts` originally held both the client-safe trait enums
  *and* the server-only prompt/provider logic in one file marked
  `import "server-only"`. The client-side trait picker
  (`app/onboarding/avatar/page.tsx`) needs those enums, and importing
  them pulled the server-only code into the client bundle — a real
  build-breaking error (`next build` caught it, not just a lint
  warning). Split into `lib/avatarStyles.ts` (client-safe: enums,
  types, validation) and `lib/avatarGen.ts` (server-only: prompt
  building, provider call), which is also cleaner separation of
  concerns independent of the bug.
- `WorldChat`'s live scrollback subscribes to `postgres_changes` INSERT
  events, whose payload only carries raw row columns — no joined
  `profiles.username` the way the initial batch `select` does. Without
  a fix, a message streamed in live would show `@unknown` even though
  the same message renders correctly after a refresh. Fixed with a
  small per-session username cache, resolved once per `user_id`.
- `noUncheckedIndexedAccess` (already on in `tsconfig.json`) caught a
  real possible-`undefined` on presence state lookups in
  `WorldCanvas.tsx`; also fixed a `ctx: CanvasRenderingContext2D | null`
  narrowing gap between the effect and the nested animation-frame
  callback that `tsc --noEmit` flagged.

## Verified this round

```
npm install        # clean
npx tsc --noEmit    # zero errors
npx eslint .         # 1 pre-existing unrelated warning, 0 errors
npm run build       # compiles clean; only failure is Google Fonts
                     # unreachable from this sandbox, not a code defect
```

## Deferred — explicit, not silently dropped

- **Voice chat** — real infra decision (WebRTC + an SFU like LiveKit or
  Daily), not a quick addition on top of the text/presence layer built
  this round.
- **District sharding** — `world:global` is a single room. The natural
  next step once it needs to hold more than a few dozen concurrent
  players in view of each other is splitting into districts (e.g.
  `world:vinewood`, `world:docks`) — a real capacity/product decision
  (how players get grouped, what happens when one fills up), not a
  quick patch.
- **Spoofable client-reported position** — same shape as H15 (Round 5):
  a modified client could broadcast a fake `x`/`y`. Low stakes today
  (cosmetic movement, no economy tied to world position), but worth
  fixing with server-side plausibility checks (max-speed clamps on the
  Realtime payload) before this carries anything higher-stakes.
- **World chat moderation** — `world_chat_log` is logged and publicly
  readable but has no admin moderation path yet. A natural extension
  of the Round 6 admin console (delete/flag a logged message,
  reusing `moderation_actions`), not built this round.
- **Character customization is portrait-only** — no body/animation
  layer (walk cycles, idle poses). The canvas renders a static portrait
  in a circle; a fuller character sprite sheet is a bigger asset
  pipeline decision.

## Mobile touch controls (added same round, after initial review)

Movement was keyboard-only when this round first shipped — a real gap
given GTAHUB is primarily a mobile product, flagged honestly rather
than left implicit.

- `components/world/TouchJoystick.tsx` — an on-screen virtual joystick
  using the Pointer Events API (unifies touch/mouse/pen handling rather
  than needing separate touch and mouse listeners). Writes into a
  mutable ref every pointermove rather than React state, matching the
  existing `keysRef` pattern in `WorldCanvas.tsx` — this updates far
  faster than a re-render cadence should run.
- Shown only on coarse-pointer (touchscreen) devices, detected once via
  `matchMedia("(pointer: coarse)")` — desktop mouse users don't get a
  cluttered on-screen control they can't usefully drag.
- The game loop combines keyboard and joystick input vectors rather
  than picking one source, so a touchscreen laptop with a keyboard
  attached can use either. The combine step also fixed a related
  correctness issue: analog joystick tilt now produces proportional
  speed (a slight tilt moves slowly) instead of the old normalize-to-
  full-speed-on-any-input behavior, which would have made the joystick
  feel like a digital d-pad instead of an analog stick.
