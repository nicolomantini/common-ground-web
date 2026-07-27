-- Run in Supabase → SQL Editor.
-- Stores a WhatsApp contact number for counselors who want it.
-- Store as digits only, with country code, no + or spaces (e.g. "31612345678"
-- for a Dutch mobile number) — that's the format WhatsApp's own click-to-chat
-- links require.

alter table public.counselors
  add column if not exists whatsapp text;
