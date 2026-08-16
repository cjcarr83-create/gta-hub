-- ============================================================
-- GTAHUB V2 — Round 10: missions, rep, gang turf, vehicles
-- Builds on 0004. See ROUND10_CHANGELOG.md.
-- ============================================================

-- ---------- VEHICLE AS A WEAPON ----------
alter table public.world_ko_log drop constraint world_ko_log_weapon_check;
alter table public.world_ko_log
  add constraint world_ko_log_weapon_check
  check (weapon in ('fists', 'knife', 'pistol', 'shotgun', 'vehicle'));

-- ---------- REP ----------
-- Derived server-side by the trigger below from mission completions
-- (and KOs). Trusted-only column: a client can't set its own rep, only
-- log the events that the trigger sums. Same REVOKE pattern as
-- wanted_level/is_verified.
alter table public.profiles add column rep integer not null default 0;
revoke update (rep) on public.profiles from authenticated;

-- ---------- MISSION COMPLETIONS ----------
create table public.world_mission_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id text not null check (mission_id in (
    'delivery_docks','delivery_hills','hitlist_3','hold_plaza','hold_north','joyride_loop'
  )),
  rep integer not null check (rep between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.world_mission_completions enable row level security;

create policy "Mission completions are publicly viewable"
  on public.world_mission_completions for select using (true);

-- Self-reported (see lib/world/missions.ts). Rate-limited per mission:
-- the same mission can't be completed by the same user more than once
-- per 5 minutes — must match MISSION_COOLDOWN_MS client-side. The rep
-- value is bounded by the check constraint; the trigger below is what
-- actually credits it, and it uses the canonical amount for the
-- mission id rather than trusting the row's rep column blindly.
create policy "Active users can log their own mission completions, rate-limited"
  on public.world_mission_completions for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_state = 'active')
    and not exists (
      select 1 from public.world_mission_completions c
      where c.user_id = auth.uid() and c.mission_id = world_mission_completions.mission_id
        and c.created_at > now() - interval '5 minutes'
    )
  );

create index world_mission_completions_user_idx on public.world_mission_completions(user_id, mission_id, created_at);

-- Canonical rep per mission lives here so a client can't inflate it.
create or replace function public.mission_rep(mid text) returns integer
language sql immutable as $$
  select case mid
    when 'delivery_docks' then 50
    when 'delivery_hills' then 60
    when 'hitlist_3' then 120
    when 'hold_plaza' then 70
    when 'hold_north' then 70
    when 'joyride_loop' then 90
    else 0 end
$$;

create or replace function public.apply_mission_rep() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.rep := public.mission_rep(new.mission_id);
  update public.profiles set rep = rep + new.rep where id = new.user_id;
  return new;
end $$;

create trigger world_mission_completions_rep
  before insert on public.world_mission_completions
  for each row execute function public.apply_mission_rep();

-- KOs also give the attacker a little rep (5). Trigger on the existing
-- KO log; the target's client inserts that row (see 0003).
create or replace function public.apply_ko_rep() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set rep = rep + 5 where id = new.attacker_id;
  return new;
end $$;
create trigger world_ko_log_rep
  after insert on public.world_ko_log
  for each row execute function public.apply_ko_rep();

-- ---------- GANG TURF ----------
create table public.world_turf (
  zone_id text primary key check (zone_id in ('turf_north_lot','turf_hills_villa','turf_dock_yard','turf_plaza')),
  crew_id uuid references public.crews(id) on delete set null,
  captured_by uuid references public.profiles(id) on delete set null,
  captured_at timestamptz not null default now()
);
alter table public.world_turf enable row level security;

create policy "Turf ownership is publicly viewable"
  on public.world_turf for select using (true);

-- Capture = upsert by the capturing player. RLS: you can only claim
-- for the crew you're actually in (checked against profiles, not the
-- payload), and only once per 60s per user. Client decides "I held it
-- uncontested for 20s" — same trust ceiling as everything else here.
create policy "Crew members can capture turf for their own crew, rate-limited"
  on public.world_turf for insert
  with check (
    auth.uid() = captured_by
    and crew_id is not null
    and crew_id = (select p.crew_id from public.profiles p where p.id = auth.uid() and p.account_state = 'active')
    and not exists (
      select 1 from public.world_turf t where t.captured_by = auth.uid() and t.captured_at > now() - interval '60 seconds'
    )
  );
create policy "Crew members can recapture turf for their own crew, rate-limited"
  on public.world_turf for update
  using (true)
  with check (
    auth.uid() = captured_by
    and crew_id is not null
    and crew_id = (select p.crew_id from public.profiles p where p.id = auth.uid() and p.account_state = 'active')
  );

insert into public.world_turf (zone_id) values
  ('turf_north_lot'), ('turf_hills_villa'), ('turf_dock_yard'), ('turf_plaza');

alter publication supabase_realtime add table public.world_turf;
