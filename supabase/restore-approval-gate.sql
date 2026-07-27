-- Run this once things are working, to turn the approval gate back on —
-- undoes disable-approval-gate-temp.sql

drop policy if exists "Public can view all profiles (temporary - no approval gate)" on public.counselors;

create policy "Public can view approved profiles"
  on public.counselors for select
  to public
  using (approved = true);
