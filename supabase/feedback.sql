-- Run in Supabase → SQL Editor.
-- A feedback/comments board visible only to logged-in counselors — no public
-- (anon) access at all, unlike counselors/reviews which are partly public.

drop table if exists public.feedback cascade;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Any logged-in counselor can post feedback, tagged as themselves
create policy "Logged-in users can post feedback"
  on public.feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Any logged-in counselor can see every entry — this is a shared, members-only board
create policy "Logged-in users can view all feedback"
  on public.feedback for select
  to authenticated
  using (true);

-- A user can delete their own feedback (e.g. to retract something)
create policy "Users can delete their own feedback"
  on public.feedback for delete
  to authenticated
  using (auth.uid() = user_id);

-- No policy at all for the `anon` role — visitors and the public site can
-- never read or write this table, by default-deny (RLS blocks everything
-- that isn't explicitly allowed above).
