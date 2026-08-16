-- ============================================================
-- GTAHUB V2 — Consolidated Schema
-- Combines: original prototype schema + crews + GTA content
-- categories + garage/vehicle builds + tips (see project docs
-- 03_v2_blueprint, 06_monetization_and_plugins, 11_gta_identity,
-- 12_creator_earnings for the reasoning behind each choice).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- ACCOUNT STATE ----------
-- Replaces the prototype's unenforced `is_banned` boolean (audit finding #2)
-- with a real state enum that RLS policies actually check.
create type account_state as enum ('active', 'restricted', 'suspended', 'banned');

-- ---------- CONTENT CATEGORY ----------
-- GTA-specific content model (11_gta_identity §1), not a generic
-- free-form tag system.
create type content_category as enum (
  'stunts', 'heists', 'rp', 'chaos', 'races', 'builds', 'guides'
);

create type content_source as enum ('vanilla', 'modded', 'rp_server');

-- ---------- CREWS ----------
create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (char_length(name) between 3 and 40),
  motto text,
  emblem_url text,
  color_hex text,
  owner_id uuid not null, -- references profiles(id), added after profiles below
  recruitment_status text not null default 'open' check (recruitment_status in ('open','closed')),
  created_at timestamptz not null default now()
);

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (
    char_length(username) between 3 and 24 and username ~ '^[a-z0-9_]+$'
  ),
  display_name text,
  avatar_url text,
  bio text check (char_length(bio) <= 280),
  account_state account_state not null default 'active',
  crew_id uuid references public.crews(id) on delete set null,
  wanted_level int not null default 0 check (wanted_level between 0 and 5), -- cosmetic reputation, 11_gta_identity §5
  radio_station text, -- cosmetic flair, 11_gta_identity §6
  -- Platform verification — admin-granted only, never self-editable.
  -- Same trusted-column pattern as wanted_level/account_state below.
  is_verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.crews
  add constraint crews_owner_fk foreign key (owner_id) references public.profiles(id) on delete cascade;

alter table public.profiles enable row level security;
alter table public.crews enable row level security;

create policy "Profiles are publicly viewable"
  on public.profiles for select using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Active users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id and account_state = 'active');

-- M1 fix: wanted_level is cosmetic reputation computed from platform
-- activity, not a self-editable field, and account_state/crew_id
-- moderation shouldn't be user-settable either. crew_id stays
-- client-writable (joining/leaving a crew is a normal user action);
-- wanted_level and account_state do not.
revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_url, bio, radio_station, crew_id)
  on public.profiles to authenticated;

create policy "Crews are publicly viewable"
  on public.crews for select using (true);

create policy "Active users can create a crew"
  on public.crews for insert
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_state = 'active')
  );

create policy "Crew owner can update their crew"
  on public.crews for update using (auth.uid() = owner_id);

-- ---------- VIDEOS ----------
-- video_url/thumbnail/duration are populated by the Mux webhook handler
-- (trusted server layer), never written directly by the client — see
-- 02_audit finding #7 and 09_security checklist.
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  title text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) <= 1000),
  category content_category not null,
  source content_source not null default 'vanilla',
  location_tag text, -- optional stylized map location, 11_gta_identity §3

  mux_asset_id text,
  mux_upload_id text,
  playback_id text,
  thumbnail_url text,
  duration_seconds int,
  processing_status text not null default 'uploading'
    check (processing_status in ('uploading','processing','ready','failed')),

  view_count bigint not null default 0, -- trusted-only increments, see 09_security
  is_public boolean not null default true,
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible','flagged','removed')),
  created_at timestamptz not null default now()
);

alter table public.videos enable row level security;

create policy "Visible public videos are viewable by everyone"
  on public.videos for select
  using (
    (is_public = true and moderation_status = 'visible')
    or auth.uid() = user_id
  );

create policy "Active users can insert their own videos"
  on public.videos for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_state = 'active')
  );

-- C6 fix (Round 3 audit): Round 2 only revoked/granted UPDATE columns.
-- INSERT was untouched — an authenticated client could still insert its
-- own row while supplying view_count, mux_asset_id, playback_id,
-- processing_status, moderation_status etc directly, since Postgres
-- treats INSERT and UPDATE privileges independently. The RLS policy
-- above only checked row ownership, not which columns were being set.
--
-- Fix: revoke INSERT entirely for the authenticated role. All video
-- rows are now created exclusively via the trusted route
-- (app/api/videos/create-upload-url), matching what the app already
-- did in practice (H1, Round 2) — this just makes it impossible to
-- bypass by calling Supabase directly instead of the API route.
revoke insert on public.videos from authenticated;

create policy "Users can update editable fields on their own videos"
  on public.videos for update using (auth.uid() = user_id);

-- C2 fix: row policy alone doesn't stop a client from setting trusted
-- columns (view_count, mux_asset_id, playback_id, processing_status,
-- moderation_status, etc) on a row they own. REVOKE the broad grant
-- Supabase applies by default, then GRANT only the columns a creator
-- should actually be able to edit. Trusted fields are then only
-- writable by the service-role client (lib/supabase/trusted.ts), which
-- bypasses grants entirely — exactly matching the intended trust
-- boundary instead of just describing it in comments.
revoke update on public.videos from authenticated;
grant update (title, description, category, source, location_tag, is_public, crew_id)
  on public.videos to authenticated;

create policy "Users can delete their own videos"
  on public.videos for delete using (auth.uid() = user_id);

-- C9 fix (Round 4 audit): a client-writable DELETE let a user delete
-- their own video row directly through Supabase, which (a) orphaned the
-- Mux asset — nothing told Mux to delete it, so it kept existing and
-- costing storage — and (b) let a user erase rows to reset the upload
-- rate limit, which counted rows in `videos` and therefore shrank when
-- rows disappeared. Deletion now only happens via
-- app/api/videos/[id]/route.ts (trusted), which deletes the Mux asset
-- first. Rate limiting moved to the insert-only `upload_attempts` log
-- further down, which a video deletion can't affect.
revoke delete on public.videos from authenticated;

create index videos_user_id_idx on public.videos(user_id);
create index videos_category_idx on public.videos(category);
create index videos_created_at_idx on public.videos(created_at desc);
create index videos_crew_id_idx on public.videos(crew_id);

-- ---------- GARAGE (vehicle builds) ----------
-- 11_gta_identity §3 — the highest-leverage GTA-specific content type.
create table public.garage_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_name text not null check (char_length(vehicle_name) <= 60),
  livery_description text,
  performance_class text,
  photo_url text,
  video_id uuid references public.videos(id) on delete set null,
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now()
);

alter table public.garage_builds enable row level security;

create policy "Garage builds are publicly viewable"
  on public.garage_builds for select using (true);

create policy "Active users can insert their own garage builds"
  on public.garage_builds for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_state = 'active')
  );

create policy "Users can update their own garage builds"
  on public.garage_builds for update using (auth.uid() = user_id);

create policy "Users can delete their own garage builds"
  on public.garage_builds for delete using (auth.uid() = user_id);

create index garage_builds_user_id_idx on public.garage_builds(user_id);

-- ---------- STREAMS ----------
create table public.streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  title text not null check (char_length(title) between 1 and 100),
  category content_category not null,

  mux_stream_id text,
  mux_playback_id text,
  status text not null default 'idle' check (status in ('idle','live','ended')),
  viewer_count int not null default 0, -- trusted-only, updated via webhook

  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.streams enable row level security;

create policy "Streams are publicly viewable"
  on public.streams for select using (true);

create policy "Active users can create their own streams"
  on public.streams for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_state = 'active')
  );

-- C6 fix: same as videos above — mux_stream_id/mux_playback_id/status/
-- viewer_count are trusted operational fields; INSERT is revoked so
-- stream rows can only be created via app/api/streams (trusted route).
revoke insert on public.streams from authenticated;

create policy "Users can update their own stream metadata"
  on public.streams for update using (auth.uid() = user_id);

-- C3 fix: same pattern as C2 — mux_stream_id, mux_playback_id, status,
-- viewer_count and timestamps are operational state, only the trusted
-- webhook handler (app/api/webhooks/mux) should ever set them.
revoke update on public.streams from authenticated;
grant update (title, category, crew_id)
  on public.streams to authenticated;

create index streams_status_idx on public.streams(status);

-- ---------- FOLLOWS ----------
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

create policy "Follows are publicly viewable"
  on public.follows for select using (true);

create policy "Active users can follow others"
  on public.follows for insert
  with check (
    auth.uid() = follower_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_state = 'active')
  );

create policy "Users can unfollow"
  on public.follows for delete using (auth.uid() = follower_id);

-- ---------- COMMENTS ----------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.videos(id) on delete cascade,
  stream_id uuid references public.streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now(),
  check (
    (video_id is not null and stream_id is null) or
    (video_id is null and stream_id is not null)
  )
);

alter table public.comments enable row level security;

create policy "Comments are viewable if their parent content is visible"
  on public.comments for select
  using (
    (video_id is not null and exists (
      select 1 from public.videos v
      where v.id = video_id
        and (v.is_public = true and v.moderation_status = 'visible' or v.user_id = auth.uid())
    ))
    or
    (stream_id is not null and exists (
      select 1 from public.streams s where s.id = stream_id
    ))
    or auth.uid() = user_id -- authors can always see their own comment
  );

create policy "Active users can post comments"
  on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_state = 'active')
  );

create policy "Users can delete their own comments"
  on public.comments for delete using (auth.uid() = user_id);

create index comments_video_id_idx on public.comments(video_id);
create index comments_stream_id_idx on public.comments(stream_id);

-- ---------- TIPS (12_creator_earnings) ----------
-- Written exclusively by the trusted server layer after Stripe confirms
-- payment. No client role has insert/update access — see policy below.
create table public.tips (
  id uuid primary key default gen_random_uuid(),
  tipper_id uuid references public.profiles(id) on delete set null,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  stream_id uuid references public.streams(id) on delete set null,
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'aud',
  message text check (char_length(message) <= 200),
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_transfer_id text,
  -- C8 fix (Round 4 audit): Round 3 recalculated the creator's net
  -- amount from the CURRENT `PLATFORM_TAKE_RATE` constant every time a
  -- webhook handler ran — at succeeded, at dispute, potentially at
  -- refund. If that constant ever changes between when a tip was
  -- created and when its webhook events fire, the accounting for
  -- in-flight tips silently uses the wrong rate. These are computed
  -- ONCE at creation time (in /api/tips) and never recalculated —
  -- every downstream ledger entry reads from here, not from the
  -- current constant.
  platform_fee_cents int,
  creator_net_cents int,
  -- Full dispute lifecycle (C8): Round 3 only handled dispute creation.
  -- 'won' means Stripe returned the funds to the platform (reversal
  -- should be undone / funds restored to creator); 'lost' means the
  -- reversal stands.
  dispute_status text not null default 'none'
    check (dispute_status in ('none', 'open', 'won', 'lost')),
  stripe_reversal_id text,
  -- C10 fix (Round 5 audit): Round 4's refund handling treated ANY
  -- charge.refunded event as "the whole tip is refunded" and debited
  -- the full creator_net_cents — wrong for partial refunds, and wrong
  -- because a destination-charge refund does NOT automatically reverse
  -- the connected account's transfer (confirmed against Stripe's own
  -- Connect docs: the platform is left to cover the negative balance
  -- unless the refund is created with reverse_transfer=true). This
  -- tracks the cumulative amount actually recovered, so a tip is only
  -- marked fully 'refunded' once that equals amount_cents.
  cumulative_refunded_cents int not null default 0,
  status text not null default 'pending'
    check (status in ('pending','succeeded','failed','partially_refunded','refunded','disputed')),
  created_at timestamptz not null default now(),
  check (
    (video_id is not null and stream_id is null) or
    (video_id is null and stream_id is not null) or
    (video_id is null and stream_id is null)
  )
);

alter table public.tips enable row level security;

create policy "Users can view tips they sent or received"
  on public.tips for select
  using (auth.uid() = tipper_id or auth.uid() = creator_id);

-- ---------- TIP REFUNDS (C10 fix) ----------
-- One row per actual Stripe refund object (a tip can be partially
-- refunded more than once). This is what makes refund processing
-- idempotent and auditable — a duplicate webhook delivery for the same
-- Stripe refund id can't double-debit the ledger, and the exact
-- provider ids used for recovery are preserved rather than only living
-- briefly in a log line.
create table public.tip_refunds (
  id uuid primary key default gen_random_uuid(),
  tip_id uuid not null references public.tips(id) on delete cascade,
  stripe_refund_id text not null unique,
  gross_refund_cents int not null check (gross_refund_cents > 0),
  -- What was actually recovered from the creator's connected account —
  -- may be less than the proportional amount if the transfer reversal
  -- failed or the account had insufficient balance. Tracked separately
  -- from the gross Stripe refund amount rather than assumed equal.
  creator_recovered_cents int not null default 0,
  stripe_transfer_reversal_id text,
  status text not null default 'pending'
    check (status in ('pending', 'recovered', 'recovery_failed')),
  created_at timestamptz not null default now()
);

alter table public.tip_refunds enable row level security;
-- No client policies — trusted-route/webhook-only.

-- Deliberately NO insert/update policy for the client roles. All writes
-- happen via the service-role key from a trusted server route/edge
-- function, after Stripe payment confirmation — see 12_creator_earnings §1.

create table public.creator_payout_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_account_id text unique not null,
  onboarding_status text not null default 'pending'
    check (onboarding_status in ('pending','complete','restricted')),
  created_at timestamptz not null default now()
);

alter table public.creator_payout_accounts enable row level security;

create policy "Users can view their own payout account"
  on public.creator_payout_accounts for select using (auth.uid() = user_id);

-- Inserts/updates to this table happen only via the trusted Stripe
-- Connect onboarding server route.

-- ---------- LEDGER (C5 fix) ----------
-- Round 1's Stripe webhook only flipped `tips.status`, which the README
-- incorrectly described as "the creator's balance updates." This table
-- is the actual, append-only accounting record — a creator's balance is
-- always *computed* by summing their ledger rows, never stored/mutated
-- directly, so it can't drift from the transaction history.
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  tip_id uuid references public.tips(id) on delete set null,
  -- C10 fix (Round 5 audit): a tip can now have MULTIPLE refund_debit
  -- entries (one per partial refund), so idempotency for that entry
  -- type has to key on the specific tip_refund, not just the tip.
  tip_refund_id uuid references public.tip_refunds(id) on delete set null,
  amount_cents int not null, -- net to creator; negative for holds/reversals
  entry_type text not null check (
    entry_type in ('tip_credit', 'dispute_hold', 'dispute_release', 'refund_debit', 'payout_debit')
  ),
  created_at timestamptz not null default now()
);

alter table public.ledger_entries enable row level security;

create policy "Creators can view their own ledger"
  on public.ledger_entries for select using (auth.uid() = creator_id);

-- tip_credit/dispute_hold/dispute_release still key on (tip_id,
-- entry_type) — a tip can only be credited once, and dispute state is
-- one-hold-per-tip in this model (see original comment, now split from
-- refund_debit below since that one legitimately repeats per tip).
create unique index ledger_entries_tip_entry_type_idx
  on public.ledger_entries (tip_id, entry_type)
  where entry_type in ('tip_credit', 'dispute_hold', 'dispute_release');

-- refund_debit idempotency keys on the specific refund event instead —
-- prevents double-processing the SAME Stripe refund webhook delivery
-- without blocking a second, genuinely different partial refund on the
-- same tip.
create unique index ledger_entries_refund_idx
  on public.ledger_entries (tip_refund_id)
  where entry_type = 'refund_debit';

-- Insert-only via the trusted webhook handler. No client role has
-- insert/update access — this is the money equivalent of the
-- trusted-only counters described in the original audit.

-- ---------- WEBHOOK EVENT JOURNAL (M7 fix, R1; H9 fix, R2; C7 fix, R3) ----------
-- R2's journal treated "a row exists" as claimed. R3 added a status
-- machine (processing/processed/failed) but a concurrent duplicate
-- delivery arriving while a row was already 'processing' would just
-- "fall through and retry" — not a real exclusive claim, so two workers
-- could both run stripe.transfers.createReversal() for the same dispute.
-- Fixed with real lease semantics: locked_at + attempt_count, and claims
-- happen via an atomic conditional UPDATE (see both webhook routes),
-- which Postgres serializes at the row level — only one concurrent
-- request can win that UPDATE for a given event id.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'mux')),
  provider_event_id text not null,
  event_type text not null,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  locked_at timestamptz not null default now(),
  attempt_count int not null default 1,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table public.webhook_events enable row level security;
-- No client policies at all — this table is trusted-server-only, never
-- queried from the browser.

-- ---------- VIEW COUNTING (H12 fix) ----------
-- Round 2 displayed videos.view_count / streams.viewer_count and
-- described them as "trusted-only," which was true in the sense that
-- clients couldn't overwrite them directly — but nothing actually
-- incremented them either. They were trusted-but-empty. These tables
-- back the real counting routes in app/api/videos/[id]/view and
-- app/api/streams/[id]/ping.

-- Dedup table for clip views: a viewer (signed-in or anonymous session)
-- only counts once per video per window, so refreshing a page or
-- re-watching doesn't inflate the count.
create table public.video_view_dedup (
  video_id uuid not null references public.videos(id) on delete cascade,
  viewer_key text not null, -- auth.uid() if signed in, else an anonymous session id
  last_viewed_at timestamptz not null default now(),
  primary key (video_id, viewer_key)
);
alter table public.video_view_dedup enable row level security;
-- No client policies — trusted-route-only, same as webhook_events.

-- Heartbeat table for live viewer presence. A viewer's client pings
-- periodically while watching; viewer_count is recomputed as "how many
-- distinct viewer_keys pinged this stream in the last 60 seconds" on
-- each ping. This is an approximation (accurate to within one heartbeat
-- interval, and only as good as viewers actually staying connected to
-- send pings) rather than a reconciled/cron-backed count — noted
-- honestly rather than presented as more precise than it is.
create table public.stream_viewer_pings (
  stream_id uuid not null references public.streams(id) on delete cascade,
  viewer_key text not null,
  last_ping_at timestamptz not null default now(),
  primary key (stream_id, viewer_key)
);
alter table public.stream_viewer_pings enable row level security;
-- No client policies — trusted-route-only.

-- ---------- UPLOAD ATTEMPT LOG (C9 fix) ----------
-- The upload rate limit previously counted rows in `videos` created in
-- the last hour — which a user could reset by deleting their own
-- videos (before C9 also closed that DELETE hole). This is a separate,
-- insert-only, never-deleted log that the rate limit reads from
-- instead, so deleting content has no effect on the limit.
create table public.upload_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.upload_attempts enable row level security;
-- No client policies — trusted-route-only (written by the same route
-- that creates the video row, never by the client directly).
create index upload_attempts_user_id_idx on public.upload_attempts(user_id, created_at);

-- ---------- AUTO-CREATE PROFILE ON SIGNUP ----------
-- Hardened per audit finding #4 (Round 1) and C1 (Round 2): explicit safe
-- search_path, and the collision path now NEVER mutates another user's
-- existing row. Round 1's `ON CONFLICT ... DO UPDATE` updated whichever
-- row already held the username — i.e. a stranger's profile — instead of
-- the new user. Fixed by retrying insert with a random unique suffix
-- scoped only to the new user's own row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_username text;
  final_username text;
  attempt int := 0;
begin
  candidate_username := lower(coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)));
  candidate_username := regexp_replace(candidate_username, '[^a-z0-9_]', '', 'g');
  if char_length(candidate_username) < 3 then
    candidate_username := 'user_' || substr(new.id::text, 1, 8);
  end if;
  candidate_username := substr(candidate_username, 1, 24);

  final_username := candidate_username;

  loop
    begin
      insert into public.profiles (id, username, display_name)
      values (new.id, final_username, coalesce(new.raw_user_meta_data->>'username', 'New User'));
      exit; -- success
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 5 then
        -- fall back to a guaranteed-unique username derived from the
        -- auth user id rather than looping indefinitely
        final_username := 'user_' || replace(new.id::text, '-', '');
        insert into public.profiles (id, username, display_name)
        values (new.id, substr(final_username, 1, 24), coalesce(new.raw_user_meta_data->>'username', 'New User'));
        exit;
      end if;
      -- retry with a short random suffix; never touches any other row
      final_username := substr(candidate_username, 1, 18) || '_' || substr(md5(random()::text), 1, 4);
    end;
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ADMIN CONSOLE
-- ============================================================

-- ---------- ADMIN USERS ----------
-- Deliberately has ZERO client policies — not even SELECT. A client
-- (including the platform owner's own logged-in session, using the
-- normal anon-key client) can never read this table directly; only the
-- trusted service-role client can, which is what every admin API route
-- uses to check "is this caller actually an admin" before doing
-- anything. This is not spoofable by editing localStorage, forging a
-- request, or any client-side trick — the check happens entirely
-- server-side against a table the client has no visibility into at all.
create table public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- No policies — RLS enabled with zero grants means even a hypothetical
-- future client-side query returns nothing, not an error that leaks
-- structure.

-- Bootstrap: there's no chicken-and-egg-safe way for the FIRST admin to
-- grant themselves access through the app (that would mean anyone could
-- self-promote). Insert the first admin manually via the Supabase SQL
-- editor after finding your own user id in auth.users:
--
--   insert into public.admin_users (user_id, note)
--   values ('YOUR-USER-UUID-HERE', 'platform owner, bootstrap');
--
-- After that, the admin console itself can grant further admins if you
-- build that capability — not included here since the audit's own
-- guidance throughout this project has been to scope tightly rather
-- than build unrequested surface area, and a single-owner console is
-- what was actually asked for.

-- ---------- MODERATION AUDIT LOG ----------
-- Every admin action (verify, restrict, suspend, ban, reactivate) is
-- recorded here permanently. Trusted-write-only; the target user can
-- see actions taken against their own account (transparency), but
-- cannot see the admin's identity or other users' records.
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null check (
    action_type in ('verify', 'unverify', 'restrict', 'suspend', 'ban', 'reactivate')
  ),
  reason text,
  created_at timestamptz not null default now()
);
alter table public.moderation_actions enable row level security;

create policy "Users can see actions taken on their own account"
  on public.moderation_actions for select
  using (auth.uid() = target_user_id);
-- No insert/update/delete policies for any client role — trusted admin
-- routes only.

-- ============================================================
-- YOUTUBE INTEGRATION (embedded, not re-hosted — see IMPLEMENTATION_NOTES.md
-- in this migration's accompanying docs for why re-hosting would be a
-- real copyright problem and embedding isn't)
-- ============================================================

create table public.youtube_embeds (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null unique, -- the 11-char YouTube video id, e.g. "dQw4w9WgXcQ"
  title text not null,
  channel_title text,
  thumbnail_url text,
  category content_category, -- reuses the same GTA-specific categories as native videos
  is_featured boolean not null default false, -- pinned to the Launch Hub's top slot
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.youtube_embeds enable row level security;

create policy "YouTube embeds are publicly viewable"
  on public.youtube_embeds for select using (true);
-- No client insert/update/delete — added only via the trusted admin
-- sync route (app/api/admin/youtube-sync) or manual admin curation
-- through the admin console, never directly by any user.

create index youtube_embeds_featured_idx on public.youtube_embeds(is_featured);
create index youtube_embeds_category_idx on public.youtube_embeds(category);
