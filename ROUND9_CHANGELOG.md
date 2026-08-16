# GTAHUB — Round 9: realistic weapons, blood, content gate, virtual controllers

Built on Round 8. Product direction for this round, in your words:
"real weapons and blood, we will just add a warning before people enter,
and a virtual PS/Xbox controller they can choose."

## What changed

- **Weapons reskinned**: Fists / Knife / Pistol / Shotgun replace the
  toy set. Damage/range/cooldown retuned so each has a role (knife =
  close burst, pistol = fast mid-range, shotgun = slow, brutal, short).
- **Blood FX**: particle splatter on every hit (rendered on the target's
  screen, the attacker's, and bystanders' — hit position rides on the
  existing `hp_update` broadcast), and a fading blood pool at the spot
  where a player dies. Pure canvas drawing, no assets, no extra DB
  writes. "DOWN" → "DEAD", "knocked out" → "killed" in toasts.
- **Content warning gate**: `ContentWarningGate.tsx` — a checkbox +
  button that must be actively completed once per account, recorded as
  `profiles.violence_ack_at`. Shown before the world ever renders.
- **Virtual controllers**: three touch layouts (`Shapes`, `Letters`,
  `Minimal`) selectable above the canvas; preference persists on the
  profile (`controller_scheme`) so it follows the account. Attack and
  Chat buttons are live; Interact/Emote are placeholders (see Deferred).
- Migration `0004_realistic_weapons_and_gate.sql`: drops/recreates the
  `world_ko_log.weapon` check constraint for the new ids, adds
  `violence_ack_at` and `controller_scheme` to profiles.

## Two things stated plainly, not to block you, so the design is honest

**1. A warning screen is a speed bump, not a barrier.** I built the
strongest version of "a warning before people enter" that a warning can
be — account-level, timestamped, requires an active checkbox, not a
dismissible modal in localStorage — but it is still self-attestation.
It cannot verify who is actually holding the phone. That's the right
amount of ceremony for a personal app among people who know each other,
which is how you described it. If GTAHUB ever opens up more broadly, real
age verification stops being a product nicety and becomes a legal
question (app store policies, regional law), and this gate is not that.
The code and comments say exactly this so nobody later mistakes it for
more assurance than it provides.

**2. IP is handled the same way as every prior round.** Weapon *names*
are realistic; weapon *art* is still original abstract silhouettes drawn
in canvas, not traced from any manufacturer or any existing game's
models, and nothing teaches how a real weapon operates. The controllers
are original layouts inspired by the two familiar diamond conventions
(shapes vs. letters) — generic geometry and plain letters in an original
palette, labelled "Shapes"/"Letters", not brand names, not Sony's or
Microsoft's trademarked glyphs, colorways, or controller silhouettes.

## Verified

```
npx tsc --noEmit    # zero errors
npx eslint .        # 0 errors (1 pre-existing unrelated warning)
next build          # compiles; only failures are the two Google Fonts
                    # fetches blocked by this sandbox
```

## Deferred — explicit

- **Interact / Emote buttons** are wired but no-ops. Pickups already
  auto-grab on walkover, so Interact has nothing to do yet; emotes are
  the obvious next feature to hang on that button.
- **Blood/gore intensity toggle** — many games with a content gate also
  offer an in-settings "reduce blood" option for people who accepted the
  warning but want it toned down. Trivial to add (skip `spawnBlood` /
  pool draw when off); not built this round.
- Everything still open from Rounds 7–8: real image-gen provider, voice
  chat, district sharding, position/weapon-claim spoofing hardening,
  admin moderation for world chat and combat griefing, turf/objectives.
