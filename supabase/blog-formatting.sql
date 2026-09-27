-- Run if journal.sql was applied before the formatting toolbar was added.
alter table public.journal_posts add column if not exists body_format text not null default 'plain' check (body_format in ('plain','html'));
notify pgrst, 'reload schema';
