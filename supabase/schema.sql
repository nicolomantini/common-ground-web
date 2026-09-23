-- ============================================================
-- Common Ground — Supabase schema
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
  bio text constraint counselors_bio_length check (char_length(bio) <= 350),
  focus text,
  website text,
  booking_url text,             -- personal HTTPS booking page, e.g. Cal.com
  whatsapp text,
  instagram text,
  facebook text,
  linkedin text,
  approved boolean not null default false,     -- member saves publish; admin-created starters remain hidden
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

-- A member publishes their own profile when they save it. Admin-created
-- starter profiles remain unpublished until the member makes their first save.
create or replace function public.publish_member_profile()
returns trigger as $$
begin
  if current_setting('role', true) = 'authenticated'
     and auth.uid() = new.user_id then
    new.approved = true;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_self_approval on public.counselors;
drop trigger if exists trg_publish_member_profile on public.counselors;
create trigger trg_publish_member_profile
  before insert or update on public.counselors
  for each row execute function public.publish_member_profile();

-- ---------- Row Level Security ----------
alter table public.counselors enable row level security;

-- Visitors can see approved profiles — this applies whether they're
-- logged in (e.g. a counselor browsing the public directory) or not,
-- which is why it's scoped `to public` rather than `to anon` only.
create policy "Public can view approved profiles"
  on public.counselors for select
  to public
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
