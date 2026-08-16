-- ============================================================
-- GTAHUB V2 — Round 7: AI character avatars + The Block (open world)
-- Builds on 0001_init.sql. See ROUND7_CHANGELOG.md for the full
-- design rationale, especially the copyright reasoning behind the
-- trait-picker-only avatar prompt (never freeform text).
-- ============================================================

-- ---------- AI AVATAR GENERATION ----------
-- avatar_style is the bounded set of trait choices a user picked (skin
-- tone, hair, outfit, vibe, accessory — all from fixed enums enforced
-- in app/api/profile/generate-avatar/route.ts, never freeform text).
-- Storing the choices (not just the resulting prompt string) means a
-- user can regenerate/tweak later without losing their picks, and
-- means the actual prompt text sent to whichever provider is wired up
-- is always reconstructed server-side from known-safe tokens, never
-- persisted or replayed verbatim from client input.
alter table public.profiles
  add column avatar_style jsonb,
  add column avatar_generation_status text not null default 'none'
    check (avatar_generation_status in ('none', 'pending', 'ready', 'failed'));

-- Same trusted-column pattern as wanted_level/account_state/is_verified
-- above: avatar_generation_status reflects real provider state and
-- must not be self-reportable. avatar_url stays client-writable (a
-- user can still paste their own image URL, same as today) — the
-- generation route below writes to it too, but via the trusted
-- service-role client, which bypasses grants entirely, so no grant
-- change is needed for that path.
revoke update (avatar_generation_status) on public.profiles from authenticated;

-- One row per generation attempt — an audit trail (what was actually
-- requested and what came back), and what the rate limit below reads
-- from, mirroring the upload_attempts pattern from Round 4 (C9 fix):
-- insert-only, never deleted, so it can't be reset by the user.
create table public.avatar_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  style jsonb not null,
  provider text not null,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed')),
  result_url text,
  error text,
  created_at timestamptz not null default now()
);

alter table public.avatar_generations enable row level security;

create policy "Users can view their own avatar generation history"
  on public.avatar_generations for select using (auth.uid() = user_id);
-- No insert/update/delete policies for any client role — trusted route
-- only (app/api/profile/generate-avatar), same trust boundary as every
-- other provider-integration table in this project.

create index avatar_generations_user_id_idx
  on public.avatar_generations(user_id, created_at);

-- ============================================================
-- THE BLOCK — shared open-world presence
-- ============================================================
-- Deliberately NOT a position table. Player position updates many
-- times a second while someone is in the world — writing that to
-- Postgres would be either a write-amplification problem or a stale,
-- throttled approximation not worth persisting. Position lives only in
-- Supabase Realtime (Presence for roster, Broadcast for movement),
-- entirely in-memory on Supabase's Realtime servers, never touching
-- this database. See lib/world/presence.ts.
--
-- What DOES need a durable row: a lightweight, moderatable audit log
-- of world chat, separate from the ephemeral broadcast used to render
-- speech bubbles in real time. Messages render instantly from the
-- broadcast event; this table is the record an admin could later
-- review/moderate, not the render path itself.
create table public.world_chat_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 200),
  scope text not null default 'district' check (scope in ('district', 'nearby')),
  created_at timestamptz not null default now()
);

alter table public.world_chat_log enable row level security;

create policy "World chat log is publicly viewable"
  on public.world_chat_log for select using (true);

-- Insert IS client-writable (unlike most tables in this project) —
-- chat needs to feel instant, and the real-time render path is the
-- broadcast event, not a round trip through this table. This row is
-- fire-and-forget logging alongside that broadcast (see
-- components/world/WorldCanvas.tsx), not the source of truth for what
-- renders on screen. RLS still enforces the author can only log
-- messages as themselves, only while active, AND rate-limits directly
-- in the policy: unlike videos (Round 4, C9 fix), there's no client
-- delete policy on this table, so a user can't reset the count by
-- deleting rows — counting the log itself is safe here, no separate
-- attempts table needed.
create policy "Active users can log their own world chat messages, rate-limited"
  on public.world_chat_log for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_state = 'active')
    and (
      select count(*) from public.world_chat_log w
      where w.user_id = auth.uid() and w.created_at > now() - interval '10 seconds'
    ) < 5
  );

-- No update/delete for any client role — an admin moderation path
-- (deleting/flagging a logged message) is a natural extension of the
-- moderation_actions console from Round 6, not built this round.

create index world_chat_log_created_at_idx on public.world_chat_log(created_at desc);
create index world_chat_log_user_created_idx on public.world_chat_log(user_id, created_at);

-- Required for components/world/WorldChat.tsx's live scrollback, which
-- subscribes to postgres_changes INSERT events on this table — that
-- Realtime feature only fires for tables explicitly added to this
-- publication (unlike Presence/Broadcast on world:global above, which
-- don't touch Postgres at all and need no such registration).
alter publication supabase_realtime add table public.world_chat_log;
