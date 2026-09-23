-- Run once in Supabase SQL Editor, then reload the practitioner dashboard.
-- Existing profiles retain their content and have no booking link until added.
alter table public.counselors
  add column if not exists booking_url text;
notify pgrst, 'reload schema';
