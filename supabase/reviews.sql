-- Run in Supabase → SQL Editor.
-- Visitor-submitted reviews for each counselor. Same pattern as counselor
-- profiles: anyone can submit, but a review only shows publicly once you
-- approve it (Table Editor → reviews → approved → true).

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references public.counselors(id) on delete cascade,
  name text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

-- Anyone can leave a review
create policy "Anyone can submit a review"
  on public.reviews for insert
  to anon, authenticated
  with check (true);

-- Anyone can see approved reviews (public and logged-in visitors alike —
-- see the note in schema.sql about why this uses `to public`, not `to anon`)
create policy "Public can view approved reviews"
  on public.reviews for select
  to public
  using (approved = true);
