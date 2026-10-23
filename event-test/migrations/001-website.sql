-- Test website bootstrap. Apply only to eicpgkmajosuhrqtrgrf.
begin;
-- Source: supabase/schema.sql
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
  bio text constraint counselors_bio_length check (char_length(bio) <= 1500),
  focus text,
  website text,
  booking_url text,             -- personal HTTPS booking page, e.g. Cal.com
  whatsapp text,
  instagram text,
  facebook text,
  linkedin text,
  substack text,
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
drop policy if exists "Public can view approved profiles" on public.counselors;
create policy "Public can view approved profiles"
  on public.counselors for select
  to public
  using (approved = true);

-- A logged-in counselor can always see their own profile, approved or not
drop policy if exists "Users can view their own profile" on public.counselors;
create policy "Users can view their own profile"
  on public.counselors for select
  to authenticated
  using (auth.uid() = user_id);

-- A logged-in counselor can create exactly one profile — their own
drop policy if exists "Users can insert their own profile" on public.counselors;
create policy "Users can insert their own profile"
  on public.counselors for insert
  to authenticated
  with check (auth.uid() = user_id);

-- A logged-in counselor can update only their own profile
drop policy if exists "Users can update their own profile" on public.counselors;
create policy "Users can update their own profile"
  on public.counselors for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A logged-in counselor can delete only their own profile
drop policy if exists "Users can delete their own profile" on public.counselors;
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
drop policy if exists "Public can view photos" on storage.objects;
create policy "Public can view photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos');

-- A counselor can only upload into a folder named after their own user id,
-- e.g. photos/<user_id>/headshot.jpg — this stops one counselor overwriting
-- another's photo.
drop policy if exists "Users can upload their own photo" on storage.objects;
create policy "Users can upload their own photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own photo" on storage.objects;
create policy "Users can update their own photo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own photo" on storage.objects;
create policy "Users can delete their own photo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Source: supabase/reviews.sql
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
drop policy if exists "Anyone can submit a review" on public.reviews;
create policy "Anyone can submit a review"
  on public.reviews for insert
  to anon, authenticated
  with check (true);

-- Anyone can see approved reviews (public and logged-in visitors alike —
-- see the note in schema.sql about why this uses `to public`, not `to anon`)
drop policy if exists "Public can view approved reviews" on public.reviews;
create policy "Public can view approved reviews"
  on public.reviews for select
  to public
  using (approved = true);

-- Source: supabase/signup-requests.sql
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
drop policy if exists "Anyone can submit a signup request" on public.signup_requests;
create policy "Anyone can submit a signup request"
  on public.signup_requests for insert
  to anon, authenticated
  with check (true);

-- No select/update/delete policy for anon or authenticated — that's intentional.
-- Only you, working directly in Supabase (Table Editor / SQL Editor, which run
-- as an admin role and bypass RLS), can see or manage these requests. No one
-- can read anyone else's submitted request through the app or the API.

-- Source: supabase/feedback.sql
-- Run in Supabase → SQL Editor.
-- A feedback/comments board visible only to logged-in counselors — no public
-- (anon) access at all, unlike counselors/reviews which are partly public.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Any logged-in counselor can post feedback, tagged as themselves
drop policy if exists "Logged-in users can post feedback" on public.feedback;
create policy "Logged-in users can post feedback"
  on public.feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Any logged-in counselor can see every entry — this is a shared, members-only board
drop policy if exists "Logged-in users can view all feedback" on public.feedback;
create policy "Logged-in users can view all feedback"
  on public.feedback for select
  to authenticated
  using (true);

-- A user can delete their own feedback (e.g. to retract something)
drop policy if exists "Users can delete their own feedback" on public.feedback;
create policy "Users can delete their own feedback"
  on public.feedback for delete
  to authenticated
  using (auth.uid() = user_id);

-- No policy at all for the `anon` role — visitors and the public site can
-- never read or write this table, by default-deny (RLS blocks everything
-- that isn't explicitly allowed above).

-- Source: supabase/private-feedback.sql
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
drop policy if exists "Authenticated users can submit private feedback" on public.private_feedback;
create policy "Authenticated users can submit private feedback"
  on public.private_feedback for insert
  to authenticated
  with check (true);

-- No select policy for anon or authenticated — only you, via Table Editor
-- or SQL Editor (which bypass RLS), can read these submissions. Not even
-- the person who submitted it can read it back.

-- Source: supabase/journal.sql
-- Run this complete file in Supabase SQL Editor. Safe to run again.
alter table public.counselors add column if not exists substack text;
create table if not exists public.journal_editors (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.journal_editors enable row level security;
grant select on public.journal_editors to authenticated;
revoke insert, update, delete on public.journal_editors from anon, authenticated;
drop policy if exists "Read own editor role" on public.journal_editors;
drop policy if exists "Read own editor role" on public.journal_editors;
create policy "Read own editor role" on public.journal_editors for select to authenticated using (user_id = auth.uid());
-- Nico manages the collective's journal. Other members manage their own posts.
insert into public.journal_editors(user_id)
select id from auth.users where lower(email) = 'nicolomantini@gmail.com'
on conflict do nothing;
create table if not exists public.journal_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.counselors(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  category text not null check (category in ('Poems & reflections','Practices','Conversations')),
  body_format text not null default 'plain' check (body_format in ('plain','html')),
  body text not null default '' check (char_length(body) <= 30000),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  cover_alt text not null default '' check (char_length(cover_alt) <= 300),
  video_url text check (video_url is null or video_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or (char_length(trim(body)) > 0 or video_url is not null))
);
alter table public.journal_posts add column if not exists body_format text not null default 'plain' check (body_format in ('plain','html'));
alter table public.journal_posts enable row level security;
grant select on public.journal_posts to anon, authenticated;
grant insert, update on public.journal_posts to authenticated;
revoke delete on public.journal_posts from anon, authenticated;
drop policy if exists "Read journal posts" on public.journal_posts;
drop policy if exists "Read journal posts" on public.journal_posts;
create policy "Read journal posts" on public.journal_posts for select to public using (
  status = 'published'
  or exists(select 1 from public.counselors c where c.id = author_id and c.user_id = auth.uid())
  or exists(select 1 from public.journal_editors e where e.user_id = auth.uid())
);
drop policy if exists "Create own journal posts" on public.journal_posts;
drop policy if exists "Create own journal posts" on public.journal_posts;
create policy "Create own journal posts" on public.journal_posts for insert to authenticated with check (
  exists(select 1 from public.counselors c where c.id = author_id and c.user_id = auth.uid())
);
drop policy if exists "Edit own or collective posts" on public.journal_posts;
drop policy if exists "Edit own or collective posts" on public.journal_posts;
create policy "Edit own or collective posts" on public.journal_posts for update to authenticated using (
  exists(select 1 from public.counselors c where c.id = author_id and c.user_id = auth.uid())
  or exists(select 1 from public.journal_editors e where e.user_id = auth.uid())
) with check (
  exists(select 1 from public.counselors c where c.id = author_id and c.user_id = auth.uid())
  or exists(select 1 from public.journal_editors e where e.user_id = auth.uid())
);
create or replace function public.prepare_journal_post() returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'UPDATE' then
    if new.author_id <> old.author_id then raise exception 'The author cannot be changed.'; end if;
    new.created_at = old.created_at;
    new.published_at = old.published_at;
  else
    new.published_at = null;
    new.created_at = now();
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at = now(); end if;
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists prepare_journal_post on public.journal_posts;
create trigger prepare_journal_post before insert or update on public.journal_posts for each row execute function public.prepare_journal_post();
create index if not exists journal_publication_order on public.journal_posts(status, published_at desc);
create index if not exists journal_post_author on public.journal_posts(author_id);
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('journal-covers','journal-covers',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists "Upload own journal covers" on storage.objects;
drop policy if exists "Upload own journal covers" on storage.objects;
create policy "Upload own journal covers" on storage.objects for insert to authenticated with check (
  bucket_id = 'journal-covers' and (storage.foldername(name))[1] = auth.uid()::text
  and exists(select 1 from public.counselors c where c.user_id = auth.uid())
);
notify pgrst, 'reload schema';

-- Source: supabase/events.sql
-- Run once in Supabase SQL Editor to enable shared event links. Safe to rerun.
create table if not exists public.event_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  url text not null check (char_length(url) <= 2000 and url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'),
  description text not null default '' check (char_length(description) <= 240),
  event_date date,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.event_links enable row level security;
grant select on public.event_links to anon, authenticated;
grant insert on public.event_links to authenticated;
revoke update, delete on public.event_links from anon, authenticated;
grant update(title,url,description,event_date,published) on public.event_links to authenticated;
drop policy if exists "Read event links" on public.event_links;
drop policy if exists "Read event links" on public.event_links;
create policy "Read event links" on public.event_links for select using (published or user_id = auth.uid());
drop policy if exists "Add own event links" on public.event_links;
drop policy if exists "Add own event links" on public.event_links;
create policy "Add own event links" on public.event_links for insert to authenticated with check (
 user_id = auth.uid() and exists(select 1 from public.counselors where user_id = auth.uid())
);
drop policy if exists "Edit own event links" on public.event_links;
drop policy if exists "Edit own event links" on public.event_links;
create policy "Edit own event links" on public.event_links for update to authenticated using (
 user_id = auth.uid() and exists(select 1 from public.counselors where user_id = auth.uid())
) with check (user_id = auth.uid() and exists(select 1 from public.counselors where user_id = auth.uid()));
create index if not exists event_links_owner on public.event_links(user_id);
notify pgrst, 'reload schema';

-- Source: supabase/event-details.sql
-- Run after events.sql to enable host selection and event images. Safe to rerun.
alter table public.event_links add column if not exists host_ids uuid[] not null default '{}' check (cardinality(host_ids) <= 8);
alter table public.event_links add column if not exists cover_url text check (cover_url is null or (char_length(cover_url) <= 2000 and cover_url ~ '^https://'));
alter table public.event_links add column if not exists cover_alt text not null default '' check (char_length(cover_alt) <= 200);
grant update(host_ids,cover_url,cover_alt) on public.event_links to authenticated;
create or replace function public.validate_event_hosts() returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from unnest(new.host_ids) as h(id) where h.id is null or not exists(select 1 from public.counselors c where c.id=h.id)) then
    raise exception 'Choose hosts from the practitioner list.';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_event_hosts on public.event_links;
create trigger validate_event_hosts before insert or update of host_ids on public.event_links for each row execute function public.validate_event_hosts();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('event-covers','event-covers',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists "Upload own event covers" on storage.objects;
drop policy if exists "Upload own event covers" on storage.objects;
create policy "Upload own event covers" on storage.objects for insert to authenticated with check (
 bucket_id='event-covers' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.counselors where user_id=auth.uid())
);
notify pgrst, 'reload schema';

-- Source: supabase/event-host-editing.sql
-- Run after events.sql and event-details.sql. Safe to rerun.
-- Creators and associated hosts may edit; ownership cannot be reassigned.
drop policy if exists "Read event links" on public.event_links;
drop policy if exists "Read event links" on public.event_links;
create policy "Read event links" on public.event_links for select using (
  published or user_id = auth.uid()
  or exists (
    select 1 from public.counselors c
    where c.user_id = auth.uid() and c.id = any(event_links.host_ids)
  )
);
drop policy if exists "Edit own event links" on public.event_links;
drop policy if exists "Edit hosted event links" on public.event_links;
drop policy if exists "Edit hosted event links" on public.event_links;
create policy "Edit hosted event links" on public.event_links for update to authenticated
using (
  exists (
    select 1 from public.counselors c where c.user_id = auth.uid()
      and (event_links.user_id = auth.uid() or c.id = any(event_links.host_ids))
  )
)
with check (
  exists (
    select 1 from public.counselors c where c.user_id = auth.uid()
      and (event_links.user_id = auth.uid() or c.id = any(event_links.host_ids))
  )
);
-- Explicit column permissions prevent hosts from changing the creator or row ID.
revoke update on public.event_links from authenticated;
grant update(title,url,description,event_date,published,host_ids,cover_url,cover_alt)
  on public.event_links to authenticated;
notify pgrst, 'reload schema';
grant select,insert,update,delete on public.counselors to authenticated;
grant select on public.counselors to anon;
grant select,insert on public.reviews to anon,authenticated;
grant insert on public.signup_requests to anon,authenticated;
grant select,insert,delete on public.feedback to authenticated;
grant insert on public.private_feedback to authenticated;
grant usage on schema public to event_tool_app;
grant select on public.counselors to event_tool_app;
notify pgrst, 'reload schema';
commit;
