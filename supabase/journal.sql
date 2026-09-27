-- Run this complete file in Supabase SQL Editor. Safe to run again.
begin;
alter table public.counselors add column if not exists substack text;
create table if not exists public.journal_editors (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.journal_editors enable row level security;
grant select on public.journal_editors to authenticated;
revoke insert, update, delete on public.journal_editors from anon, authenticated;
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
create policy "Read journal posts" on public.journal_posts for select to public using (
  status = 'published'
  or exists(select 1 from public.counselors c where c.id = author_id and c.user_id = auth.uid())
  or exists(select 1 from public.journal_editors e where e.user_id = auth.uid())
);
drop policy if exists "Create own journal posts" on public.journal_posts;
create policy "Create own journal posts" on public.journal_posts for insert to authenticated with check (
  exists(select 1 from public.counselors c where c.id = author_id and c.user_id = auth.uid())
);
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
create policy "Upload own journal covers" on storage.objects for insert to authenticated with check (
  bucket_id = 'journal-covers' and (storage.foldername(name))[1] = auth.uid()::text
  and exists(select 1 from public.counselors c where c.user_id = auth.uid())
);
notify pgrst, 'reload schema';
commit;
