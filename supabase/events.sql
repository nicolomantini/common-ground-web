-- Run once in Supabase SQL Editor to enable shared event links. Safe to rerun.
begin;
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
create policy "Read event links" on public.event_links for select using (published or user_id = auth.uid());
drop policy if exists "Add own event links" on public.event_links;
create policy "Add own event links" on public.event_links for insert to authenticated with check (
 user_id = auth.uid() and exists(select 1 from public.counselors where user_id = auth.uid())
);
drop policy if exists "Edit own event links" on public.event_links;
create policy "Edit own event links" on public.event_links for update to authenticated using (
 user_id = auth.uid() and exists(select 1 from public.counselors where user_id = auth.uid())
) with check (user_id = auth.uid() and exists(select 1 from public.counselors where user_id = auth.uid()));
create index if not exists event_links_owner on public.event_links(user_id);
notify pgrst, 'reload schema';
commit;
