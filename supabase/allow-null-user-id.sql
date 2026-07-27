-- Run this once if you already ran the original schema.sql — it loosens one
-- constraint so demo/admin-added profiles can exist without a real signed-up
-- counselor account attached to them. (New projects running the updated
-- schema.sql won't need this — it's already included there.)

alter table public.counselors
  alter column user_id drop not null;
