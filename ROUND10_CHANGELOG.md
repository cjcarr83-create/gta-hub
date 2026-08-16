# GTAHUB — Round 10: gangs with turf, missions, driving, a real city

Built on Round 9. This is the round that makes The Block feel like an
actual game rather than a fight club with a chat panel.

## What's new

- **A real map.** Road grid, sidewalks, city blocks with buildings you
  can't walk through, four named districts (Northside, The Hills, The
  Docks, Downtown), a minimap in the corner. `lib/world/map.ts` —
  original layout, deterministic building placement (seeded, not
  random per-load, so the map doesn't reshuffle on refresh).
- **Driving.** Six original cars parked around the map. Walk up, press
  Interact (E, or the new Interact button on touch) to get in.
  Acceleration/drag/speed-dependent steering, not just "move faster" —
  `lib/world/vehicles.ts`. Ram someone at speed and it counts as a hit
  (weapon id `vehicle`), same trust-model rules as every other weapon.
  Cars bounce off buildings instead of clipping through them.
- **Gangs get turf.** Four capturable zones, one per district. Stand in
  an unowned or rival-owned zone with your crew, uncontested, for 20
  seconds, and it flips to your crew's color — on the map, the
  minimap, and the new Turf panel below the canvas. This is what
  "build our own gangs" turns into mechanically: crews already existed,
  now they have something to fight over.
- **Missions.** A jobs board (below the canvas) with four mission
  types — Delivery (carry a package between two points, on foot or by
  car), Hit List (get 3 kills), Hold (survive standing in a zone for
  30s), Joyride (hit 4 checkpoints by car). Completing one banks rep,
  shown live via a toast and a running total in the page header.
- **Rep**, a new profile stat. Missions and KOs both grant it, but —
  same pattern as `is_verified`/`wanted_level` — it's a trusted-only
  column derived by a database trigger from logged events, not
  something a client sets directly. See migration `0005`.

## How rep avoids the obvious client-authoritative trap

Every prior round has been honest that a modified client can lie about
its own actions — position, hits, KOs. Missions and turf add a new
temptation: if rep were just "whatever number the client sends," a
modified client could grant itself unlimited rep in one insert. It
can't, because of one specific design choice: **the client never sends
a rep amount that gets trusted.** `world_mission_completions.rep` gets
silently overwritten by a `BEFORE INSERT` trigger
(`apply_mission_rep`) that looks up the canonical amount for the
mission id from a fixed SQL function (`mission_rep()`), and that
trigger — not the insert itself — is what increments
`profiles.rep`. A client can still claim it completed a mission it
didn't (same self-reported ceiling as everything else here — RLS rate
limits it to once per mission per 5 minutes, not zero times), but it
cannot control *how much* rep that claim is worth. Same pattern for KO
rep via a second trigger on the existing `world_ko_log` table.

This is the same trust model as Rounds 7–9, applied consistently rather
than quietly loosened because missions felt like a bigger, more
official-sounding system. Worth remembering if rep ever gets tied to
anything with real value later (a shop, a rank that unlocks something) —
today it's bragging rights, same caveat as the KO leaderboard.

## Performance

Vehicles ride the same move-broadcast channel as on-foot movement — no
new broadcast frequency, just extra fields (`vehicleId`, `angle`) on a
payload that was already going out ~12×/sec. Mission progress is
entirely client-local except the one completion write. Turf capture is
one UPDATE per successful 20-second hold, not per tick — the hold timer
itself lives in a ref, not the database. The map itself (roads,
buildings, turf zone outlines) is computed once per session and drawn
from static arrays, not recalculated per frame.

## Bugs caught and fixed while building this round

- A new ESLint rule (`react-hooks/set-state-in-effect`) flagged
  `WorldRoom.tsx`'s turf-loading effect: calling an async function that
  itself calls `setState` directly in an effect body is now a real lint
  error, not just a style nit — it flagged a genuine risk of cascading
  renders. Fixed by splitting the data fetch (`fetchTurf`, no side
  effects, just returns data) from the state update (`setTurfOwners`),
  with the `setState` call moved into a `.then()` callback — the
  pattern the rule (and the underlying React guidance) actually asks
  for.
- Missed wiring on the first pass: `VirtualController` didn't have an
  `onInteract` prop, and `WorldRoom` was missing the mission/turf props
  `WorldCanvas` now requires. `tsc --noEmit` caught both immediately —
  neither shipped.
- The "minimal" touch control scheme only had a joystick and an attack
  button — no way to get in/out of a car on that scheme. Added a small
  secondary Interact button rather than leaving driving inaccessible
  for anyone using that layout.

## Verified

```
npx tsc --noEmit    # zero errors
npx eslint .        # 0 errors (1 pre-existing unrelated warning) —
                    # caught and fixed one real react-hooks error
                    # along the way, see above
next build          # compiles; only failures are the two Google Fonts
                    # fetches blocked by this sandbox (unchanged since
                    # Round 6)
```

## Deferred — explicit

- **No shooting from vehicles** — driving currently shields you from
  on-foot weapon fire entirely (a deliberate simplification, not an
  oversight) and you can't fire back while driving. Drive-by combat is
  a natural next mechanic once the base driving feel is proven out.
- **Vehicle position for players who join mid-session** — a parked
  car's position is only known from having heard a broadcast about it;
  a brand-new joiner sees all cars at their original spawn points until
  someone moves them. Low-stakes visually, same category as the
  already-deferred "ephemeral state has no late-join sync" issue from
  Round 8's pickups.
- **Weapon-claim and vehicle-claim spoofing** — unchanged limitation
  from Round 9, now also applies to "claims to be driving a car it
  never entered." Same trust ceiling, same reasoning.
- **Turf contest detection is proximity-only** — a rival merely
  standing in the zone (not actively fighting) blocks a capture. No
  real combat requirement to contest turf yet; simple on purpose for a
  first pass, could get more elaborate (must land a hit to contest,
  turf degrades over time without defense, etc.) once it's clear this
  base mechanic is fun.
- **No mission variety beyond the four types**, and no cooldown UI
  showing when a just-completed mission becomes repeatable again (RLS
  enforces the 5-minute cooldown; the board just disables Start while
  something else is active, not specifically the recently-completed
  one).
- Everything still open from Rounds 7–9: real image-gen provider, voice
  chat, district/room sharding past a single global world, admin
  moderation tooling for combat and turf griefing, a blood-intensity
  toggle.
