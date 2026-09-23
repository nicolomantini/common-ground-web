-- Run in Supabase SQL Editor to enforce the 350-character limit.
-- Also replaces an earlier 400-character constraint if already applied.
-- Existing text is preserved; new rows and updates must satisfy the limit.
begin;
alter table public.counselors
  drop constraint if exists counselors_bio_length;
alter table public.counselors
  add constraint counselors_bio_length
  check (char_length(bio) <= 350) not valid;
commit;
