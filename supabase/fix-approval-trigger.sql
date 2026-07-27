-- Fixes a bug: the original trigger blocked ALL changes to `approved`,
-- including ones made by you directly in Table Editor / SQL Editor.
-- This version only locks the field when the update comes from a normal
-- logged-in counselor session (Postgres role "authenticated") — changes
-- made via Table Editor, SQL Editor, or the service_role key go through
-- as a different role and are unaffected.

create or replace function public.prevent_self_approval()
returns trigger as $$
begin
  if current_setting('role', true) = 'authenticated' then
    new.approved = old.approved;
  end if;
  return new;
end;
$$ language plpgsql;

-- No need to recreate the trigger itself — it already points at this
-- function, so updating the function is enough.
