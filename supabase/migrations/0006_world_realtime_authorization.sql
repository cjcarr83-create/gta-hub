-- Round 12 security fix: The Block's shared multiplayer channel
-- ("world:global" — player positions, combat, presence) was a fully
-- open Realtime broadcast/presence channel. Supabase only enforces RLS
-- on realtime.messages once a channel is instantiated with
-- `private: true` on the client (see components/world/WorldCanvas.tsx);
-- until then, anyone with the anon key can listen to or inject
-- messages into any topic, including this one, regardless of sign-in
-- state or account standing. RLS was already enabled on
-- realtime.messages with zero policies (which — combined with a
-- private channel — would default-deny everyone), so these are the
-- policies that actually let signed-in, active accounts in.
--
-- Scoped to the single "world:global" topic and to active accounts
-- specifically (not just "authenticated") so a suspended/restricted
-- profile can't reach the live game over a raw realtime connection
-- even though app/world/page.tsx already blocks that account state at
-- the page level — this is the same check enforced again at the
-- transport layer, since the page-level gate is bypassable by anyone
-- who connects to Realtime directly instead of through the app's UI.
create policy "active users can receive world broadcast"
on "realtime"."messages"
for select
to authenticated
using (
  (select realtime.topic()) = 'world:global'
  and realtime.messages.extension = 'broadcast'
  and exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.account_state = 'active'
  )
);

create policy "active users can send world broadcast"
on "realtime"."messages"
for insert
to authenticated
with check (
  (select realtime.topic()) = 'world:global'
  and realtime.messages.extension = 'broadcast'
  and exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.account_state = 'active'
  )
);

create policy "active users can receive world presence"
on "realtime"."messages"
for select
to authenticated
using (
  (select realtime.topic()) = 'world:global'
  and realtime.messages.extension = 'presence'
  and exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.account_state = 'active'
  )
);

create policy "active users can send world presence"
on "realtime"."messages"
for insert
to authenticated
with check (
  (select realtime.topic()) = 'world:global'
  and realtime.messages.extension = 'presence'
  and exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.account_state = 'active'
  )
);
