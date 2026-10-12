-- Run after events.sql to enable host selection and event images. Safe to rerun.
begin;
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
create policy "Upload own event covers" on storage.objects for insert to authenticated with check (
 bucket_id='event-covers' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.counselors where user_id=auth.uid())
);
notify pgrst, 'reload schema';
commit;
