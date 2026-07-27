-- TEMPORARY: shows every profile publicly, regardless of approval status.
-- Run this to debug. Run restore-approval-gate.sql later to turn the
-- moderation gate back on once things are working.

drop policy if exists "Public can view approved profiles" on public.counselors;
drop policy if exists "Public can view all profiles (temporary - no approval gate)" on public.counselors;

create policy "Public can view all profiles (temporary - no approval gate)"
  on public.counselors for select
  to public
  using (true);
