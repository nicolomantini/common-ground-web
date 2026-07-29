-- Run in Supabase → SQL Editor.
-- Adds optional social link fields to existing counselor profiles.

alter table public.counselors
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists linkedin text;
