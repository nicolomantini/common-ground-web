-- ============================================================
-- WWP Counseling — Supabase schema
-- Run this once in your Supabase project's SQL Editor
-- (Project → SQL Editor → New query → paste this whole file → Run)
-- ============================================================

-- ---------- Table ----------
create table if not exists public.counselors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,  -- null = admin-added demo profile, not owned by any account
  name text not null,
  photo text,                    -- public URL (from Storage, see below) or null
  pronouns text,
  location text,
  specialties text[] not null default '{}',
  approach text[] not null default '{}',
  formats text[] not null default '{}',       -- e.g. {"Video","In-person","Phone"}
  languages text[] not null default '{}',
  session_length text,
  price_range text,              -- "$", "$$", or "$$$"
  availability text,             -- "Accepting new clients" / "Waitlist" / etc.
  bio text,
  focus text,
  website text,
  approved boolean not null default false,     -- you flip this on to publish a profile
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current on every edit
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_counselors_updated_at on public.counselors;
create trigger trg_counselors_updated_at
  before update on public.counselors
  for each row execute function public.set_updated_at();

-- A counselor can edit their own row, but can never approve themselves —
-- this trigger silently keeps `approved` at whatever it already was in the
-- database, no matter what value is sent in from the edit form.
create or replace function public.prevent_self_approval()
returns trigger as $$
begin
  new.approved = old.approved;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_self_approval on public.counselors;
create trigger trg_prevent_self_approval
  before update on public.counselors
  for each row execute function public.prevent_self_approval();

-- ---------- Row Level Security ----------
alter table public.counselors enable row level security;

-- Visitors (anonymous, using the public anon key) can only see approved profiles
create policy "Public can view approved profiles"
  on public.counselors for select
  to anon
  using (approved = true);

-- A logged-in counselor can always see their own profile, approved or not
create policy "Users can view their own profile"
  on public.counselors for select
  to authenticated
  using (auth.uid() = user_id);

-- A logged-in counselor can create exactly one profile — their own
create policy "Users can insert their own profile"
  on public.counselors for insert
  to authenticated
  with check (auth.uid() = user_id);

-- A logged-in counselor can update only their own profile
create policy "Users can update their own profile"
  on public.counselors for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A logged-in counselor can delete only their own profile
create policy "Users can delete their own profile"
  on public.counselors for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- Storage bucket for profile photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Anyone can view photos (needed so the public directory can display them)
create policy "Public can view photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos');

-- A counselor can only upload into a folder named after their own user id,
-- e.g. photos/<user_id>/headshot.jpg — this stops one counselor overwriting
-- another's photo.
create policy "Users can upload their own photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own photo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own photo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
