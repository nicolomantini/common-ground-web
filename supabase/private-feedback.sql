-- Run in Supabase → SQL Editor.
-- This is the PRIVATE feedback box on the dashboard ("Report an issue
-- privately") — separate from the public.feedback table, which is the
-- shared board every counselor can see. Only you can read these, via
-- Table Editor / SQL Editor.

create table if not exists public.private_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.private_feedback enable row level security;

-- Any logged-in counselor can submit privately
create policy "Authenticated users can submit private feedback"
  on public.private_feedback for insert
  to authenticated
  with check (true);

-- No select policy for anon or authenticated — only you, via Table Editor
-- or SQL Editor (which bypass RLS), can read these submissions. Not even
-- the person who submitted it can read it back.
