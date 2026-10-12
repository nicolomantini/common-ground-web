-- Run after events.sql and event-details.sql. Safe to rerun.
-- Creators and associated hosts may edit; ownership cannot be reassigned.
begin;
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
commit;
