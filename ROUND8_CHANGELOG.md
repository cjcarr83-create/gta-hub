# GTAHUB — The Block gets combat, weapons, and gangs

New this round, built on top of Round 7 (AI avatars, The Block, touch controls).

## What you can do now in The Block

- **Fight.** Every player has HP. Fists work bare-handed; pick up a Bat,
  Water Blaster, or Paintball Gun from fixed spawn points around the
  map for more range/damage. Space bar (desktop) or the red button
  (touch) auto-targets the nearest valid enemy in range.
- **Team up.** Crews (already built in earlier rounds) ARE the gang
  system here — no separate concept invented. Your crew's color shows
  as your ring in the world and under your nameplate, and crewmates
  can't be targeted by your attacks (or you by theirs). `/world` now
  prompts you to join a crew if you don't have one.
- **Get knocked out and come back.** Hit 0 HP and you're down for 2.5
  seconds, then respawn at full health at a new spot. A toast
  announces every KO to the whole room, and a rolling leaderboard
  ("recent top scrappers," last 200 fights) shows on the page below the
  canvas.

## Weapon design: playful on purpose

Fists, a bat, a water blaster, a paintball gun — deliberately original
and cartoonish rather than literal firearms. This is the same copyright
reasoning that already governs the AI avatar prompts (lib/avatarGen.ts)
and the YouTube embed handling (Round 6): nothing here should be
mistakable for one of Rockstar's actual weapon designs. It also happens
to fit better — "exciting way to kill time" reads as arcade brawler,
not gritty shooter.

## The trust model, stated plainly (see lib/world/combat.ts)

There's no authoritative game server. Every client reports its own
actions over Realtime Broadcast, same as movement (Round 7). The one
real rule: **a player's own client is the sole authority over its own
health.** An attacker broadcasts "I hit you," but the target decides
whether to believe it — checking the attacker was actually within
weapon range of the target's own last-known position, and using the
fixed `WEAPONS` damage table rather than any number the attacker's
broadcast claims. A modified client can still lie about its own
position, or claim it's holding a weapon it isn't (nothing currently
double-checks "does this attacker actually have a paintball gun" — see
Deferred below) — but it can't one-shot someone from across the map or
deal arbitrary damage.

That ceiling is fine for a casual, for-fun mode with a for-bragging-
rights leaderboard. It would NOT be fine if anything with real stakes
got attached to winning later — worth remembering before, say, tips or
verification status ever gets tied to KO count.

**Why only the target logs a KO** (`world_ko_log`, migration 0003): if
both sides could log the same fight, a modified client on either side
could double-submit it. Only the target — the side actually
authoritative over "did my HP hit zero" — can insert a row, enforced in
the RLS policy itself, not just convention.

## Performance ("can't lag")

Combat adds a handful of new broadcast event types (`hit`, `hp_update`,
`ko`, `pickup_taken`), but all of them are low-frequency — a hit only
fires when someone actually attacks (rate-limited by weapon cooldown,
550–1100ms), not every frame. Movement remains the dominant traffic at
~12 updates/sec per player, unchanged from Round 7. The only database
write in the entire combat system is one row per KO — not per hit, not
per pickup — so a busy fight doesn't touch Postgres more than a normal
walk around the map does.

The real capacity ceiling is still the one flagged in Round 7: a single
global room (`world:global`) is fine for a few dozen concurrent
players; past that, `O(n)` broadcasts per player becomes `O(n²)` total
messages, and it's time to shard into districts. Not hit yet, not built
yet — same deferred item as before, now more relevant given combat
adds a reason for players to cluster in one spot.

## Bugs caught and fixed while building this round

- The keyboard "attack" listener is registered once (empty dependency
  array), but `attemptAttack()` closes over per-render values (`crewId`,
  `channelRef`, etc.). Calling the version captured at mount time would
  have used stale crew/position data indefinitely. Fixed by routing the
  call through a ref (`attemptAttackRef`) that's reassigned to the
  latest closure every render — the listener itself never needs to be
  torn down and re-attached.
- `drawPlayer`'s `ringColor` parameter was being silently discarded for
  the self player (`isSelf ? COLORS.amber : ringColor` always took the
  amber branch), which meant a player's own crew color never rendered
  on their own avatar even though it correctly showed for everyone
  else looking at them. Fixed by giving self player an actual crew-
  colored ring like anyone else, with a separate thin amber halo
  layered outside it for "this is you" recognition instead of
  overloading the ring color for that job.
- Remote players' weapon glyph was initially hardcoded to always show
  "fists" — there was no field carrying a player's current weapon over
  the wire, only their own client knew it. Fixed by adding `weapon` to
  the existing move broadcast payload (already sent ~12×/sec, so this
  was free) instead of leaving it as a known gap.

## Verified this round

```
npx tsc --noEmit    # zero errors
npx eslint .         # 1 pre-existing unrelated warning, 0 errors
                     # (caught and fixed one real error along the way —
                     # an unescaped apostrophe in app/world/page.tsx)
npm run build       # compiles clean; only failure is Google Fonts
                     # unreachable from this sandbox, not a code defect
```

## Deferred — explicit, not silently dropped

- **Weapon-claim spoofing** — a modified attacker client could claim to
  be holding a higher-damage weapon than it actually picked up; the
  target validates range and uses the fixed damage table, but nothing
  currently cross-checks "did this attacker's own pickup history
  support holding that weapon." Low stakes today (see trust-model
  section above), same category as the already-deferred position-
  spoofing item from Round 7.
- **Weapon pickups aren't server-authoritative** — two players near a
  pickup at the same instant could both "grab" it in their own local
  state. Purely cosmetic collision, not exploitable for anything beyond
  a fight (see lib/world/combat.ts).
- **No true PvE/objectives** — this round is player-vs-player skirmish
  only. Turf control (crews contesting map zones), timed events, or
  NPC content are natural next layers once this baseline holds up with
  real usage.
- **Admin moderation for combat** — same gap as Round 7's world chat:
  no admin path yet to act on a griefing pattern (e.g. someone farming
  KOs against much lower-level or AFK players). The Round 6 admin
  console is the natural place to extend this.
