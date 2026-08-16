-- ============================================================
-- GTAHUB V2 — Round 9: realistic weapons, blood FX, content gate
-- Builds on 0003_world_combat.sql. See ROUND9_CHANGELOG.md.
-- ============================================================

-- ---------- WEAPON RESKIN ----------
-- world_ko_log.weapon's check constraint still lists the Round 8 toy
-- weapon ids ('bat', 'water_blaster', 'paintball_gun'). Postgres has no
-- ALTER CONSTRAINT for check clauses — drop and recreate is the normal
-- pattern. Existing rows with the old ids remain valid history (the
-- constraint only governs new inserts); no backfill needed for a
-- pre-launch scaffold with no real user data yet.
alter table public.world_ko_log drop constraint world_ko_log_weapon_check;
alter table public.world_ko_log
  add constraint world_ko_log_weapon_check
  check (weapon in ('fists', 'knife', 'pistol', 'shotgun'));

-- ---------- CONTENT ACKNOWLEDGMENT ----------
-- Round 9 made The Block's combat visually more intense (realistic
-- weapon names, blood effects) per an explicit product decision — see
-- ROUND9_CHANGELOG.md for the full reasoning, including why a warning
-- screen alone is a weak gate and what a real one would need.
--
-- This column is what ContentWarningGate.tsx actually checks before
-- letting a client render combat content at all: not a dismissible
-- modal that only lives in localStorage (device-level, resets on a new
-- browser, proves nothing about who agreed to what), but an explicit,
-- timestamped acknowledgment tied to the account. Self-attestation
-- only — this is not age verification, and the product code and
-- ROUND9_CHANGELOG.md are both explicit about that distinction rather
-- than implying more assurance than a checkbox actually provides.
alter table public.profiles
  add column violence_ack_at timestamptz;

-- Client-writable, unlike most trusted-only columns added in earlier
-- rounds (avatar_generation_status, is_verified, etc.) — this is a
-- self-attestation ABOUT the user, not a claim of fact something else
-- needs to verify server-side, so there's no integrity property to
-- protect by routing it through a trusted route. The value of this
-- column is the timestamped record that a checkbox was actually
-- clicked, not a guarantee that it was clicked honestly.
grant update (violence_ack_at) on public.profiles to authenticated;

-- ---------- CONTROLLER PREFERENCE ----------
-- Which virtual controller layout the player picked for The Block's
-- touch controls (see lib/world/controller.ts). Stored on the profile
-- rather than in browser storage so it follows the account across
-- devices, consistent with every other preference in this project.
-- Pure UI preference — client-writable, nothing to protect.
alter table public.profiles
  add column controller_scheme text not null default 'shapes'
    check (controller_scheme in ('shapes', 'letters', 'minimal'));
grant update (controller_scheme) on public.profiles to authenticated;
