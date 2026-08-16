-- ============================================================
-- GTAHUB V2 — Round 8: The Block gets combat + gangs
-- Builds on 0002_avatars_and_world.sql. See ROUND8_CHANGELOG.md.
-- ============================================================

-- Health, hits, and cooldowns are ALL ephemeral — same reasoning as
-- position in 0002 (see lib/world/combat.ts's trust-model comment):
-- they live only in Realtime Broadcast between clients and never touch
-- this database. The one thing worth a durable row is the final
-- outcome of a fight, for a leaderboard — infrequent (one row per KO,
-- not per hit) and low-stakes (bragging rights, not an economy), which
-- is why the self-reported trust model documented in combat.ts is an
-- acceptable trade-off here specifically.
create table public.world_ko_log (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  weapon text not null check (weapon in ('fists', 'bat', 'water_blaster', 'paintball_gun')),
  created_at timestamptz not null default now(),
  check (attacker_id <> target_id)
);

alter table public.world_ko_log enable row level security;

create policy "KO log is publicly viewable"
  on public.world_ko_log for select using (true);

-- Client-writable INSERT, same trade-off as world_chat_log (0002): the
-- alternative is a trusted route the target's client calls after
-- deciding (client-side) that it was knocked out — which wouldn't be
-- meaningfully more trustworthy, since the route would still just be
-- taking the caller's word for it. Restricted to the TARGET only (not
-- the attacker) — per combat.ts's trust model, only the target's own
-- client is authoritative over whether its own health actually hit
-- zero, so it's the only side that can log the outcome. If the
-- attacker could also insert, the same fight could be logged twice.
-- Rate-limited directly in the policy so a modified client can't flood
-- the leaderboard.
create policy "Active users can log a KO where they were the target, rate-limited"
  on public.world_ko_log for insert
  with check (
    auth.uid() = target_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_state = 'active')
    and (
      select count(*) from public.world_ko_log k
      where k.target_id = auth.uid() and k.created_at > now() - interval '10 seconds'
    ) < 5
  );

-- No update/delete for any client role.

create index world_ko_log_attacker_idx on public.world_ko_log(attacker_id, created_at);
create index world_ko_log_created_at_idx on public.world_ko_log(created_at desc);
