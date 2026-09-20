-- Apply once to an existing project. Existing profiles are unchanged.
-- New profiles must wait for admin approval, including direct API inserts.
begin;
drop policy if exists "Users can insert their own profile" on public.counselors;
create policy "Users can insert their own profile"
  on public.counselors for insert
  to authenticated
  with check (auth.uid() = user_id and approved = false);
commit;
