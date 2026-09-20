-- Run as one complete query in Supabase SQL Editor.
-- No existing profiles are published by running this migration.
begin;

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

drop policy if exists "Users can insert their own profile" on public.counselors;
create policy "Users can insert their own profile"
  on public.counselors for insert
  to authenticated
  with check (auth.uid() = user_id);

commit;
