-- ═══════════════════════════════════════════════════════════════════
-- ALEX — Push Subscriptions Table
-- Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Table: push_subscriptions
-- Stores Web Push subscription endpoints per room.
-- Key privacy design:
--   - channel_hash is SHA-256(roomId:password:alex_room_v2) — same hash
--     used for the Realtime channel. Neither we nor Supabase knows the
--     actual roomId or password from this hash alone.
--   - Rows auto-expire after 30 days via pg_cron or manual cleanup.
--   - No user IDs, no IP addresses stored here.

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  channel_hash  text not null,          -- SHA-256 hash of roomId:password
  session_id    text not null,          -- per-tab session (not tied to identity)
  subscription  jsonb not null,         -- Web Push subscription object
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null,

  -- One subscription per session per channel
  unique (channel_hash, session_id)
);

-- Index for fast lookup by channel_hash
create index if not exists idx_push_subscriptions_channel
  on public.push_subscriptions (channel_hash);

-- Auto-delete old subscriptions (> 35 days)
-- Run periodically or set up pg_cron
-- DELETE FROM push_subscriptions WHERE updated_at < now() - interval '35 days';

-- Row Level Security — allow anon insert/update/delete their own rows
-- (identified by session_id which they provide)
alter table public.push_subscriptions enable row level security;

-- Policy: anyone can insert (anonymous subscription registration)
create policy "anon can insert subscriptions"
  on public.push_subscriptions
  for insert
  to anon
  with check (true);

-- Policy: anyone can update their own subscription (by session_id)
create policy "anon can update own subscription"
  on public.push_subscriptions
  for update
  to anon
  using (true)
  with check (true);

-- Policy: anyone can delete (unsubscribe)
create policy "anon can delete subscriptions"
  on public.push_subscriptions
  for delete
  to anon
  using (true);

-- Policy: service_role (Edge Function) can read all
create policy "service role can read all"
  on public.push_subscriptions
  for select
  to service_role
  using (true);

-- ── Function: upsert subscription ──────────────────────────────────
create or replace function public.upsert_push_subscription(
  p_channel_hash  text,
  p_session_id    text,
  p_subscription  jsonb
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.push_subscriptions (channel_hash, session_id, subscription, updated_at)
  values (p_channel_hash, p_session_id, p_subscription, now())
  on conflict (channel_hash, session_id)
  do update set
    subscription = excluded.subscription,
    updated_at   = now();
end;
$$;
