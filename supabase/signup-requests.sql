-- Run this in Supabase → SQL Editor.
-- Creates a place for "I'd like to join" requests to land, without creating
-- any login account yet. You review these yourself and decide who to invite.

create table if not exists public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text,
  status text not null default 'pending',  -- 'pending' | 'invited' | 'declined' — just for your own tracking
  created_at timestamptz not null default now()
);

alter table public.signup_requests enable row level security;

-- Anyone can submit a request — this is the only public permission on this table.
create policy "Anyone can submit a signup request"
  on public.signup_requests for insert
  to anon, authenticated
  with check (true);

-- No select/update/delete policy for anon or authenticated — that's intentional.
-- Only you, working directly in Supabase (Table Editor / SQL Editor, which run
-- as an admin role and bypass RLS), can see or manage these requests. No one
-- can read anyone else's submitted request through the app or the API.
