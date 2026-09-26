-- Run in Supabase SQL Editor to enforce the 1500-character limit.
-- Also replaces an earlier description-length constraint if already applied.
-- Existing text is preserved; new rows and updates must satisfy the limit.
begin;
alter table public.counselors
  drop constraint if exists counselors_bio_length;
alter table public.counselors
  add constraint counselors_bio_length
  check (char_length(bio) <= 1500) not valid;
commit;
