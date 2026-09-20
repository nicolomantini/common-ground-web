-- Common Ground: starter profiles for the eight existing member accounts.
-- Run in the Supabase SQL Editor after confirming Authentication > Users
-- contains exactly the eight intended members. No passwords are changed.
-- All changes commit together; an error leaves the database unchanged.
begin;

-- Fail closed if the account list differs from the expected group.
do $$
begin
  if (select count(*) from auth.users) <> 8 then
    raise exception 'Expected exactly 8 member accounts. Check Authentication > Users before proceeding.';
  end if;
  if exists (select 1 from auth.users where email is null or is_anonymous = true) then
    raise exception 'The account list includes an anonymous or email-less account. Review the member list first.';
  end if;
end;
$$;

-- Preserve any profile members have already created. New rows are linked
-- to their login, so the existing dashboard can load and edit them.
-- Do not invent biographies, qualifications, prices, or availability.
insert into public.counselors (user_id, name, approved)
select
  u.id,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    'Profile to complete'
  ),
  false
from auth.users u
on conflict (user_id) do nothing;

-- Remove only the exact unowned demo profiles from seed-demo-data.sql.
-- A real login-linked profile is never matched, even if its name is similar.
-- Reviews attached to deleted samples are removed by the existing FK cascade.
delete from public.counselors c
using (values
  ('Maya Ortiz', 'https://mayaortizcounseling.example.com'),
  ('Dwayne Fisher', 'https://dwaynefishertherapy.example.com'),
  ('Priya Nair', 'https://priyanairphd.example.com'),
  ('Sam Okafor', 'https://samokaforcounseling.example.com'),
  ('Elena Voss', 'https://elenavosstherapy.example.com')
) as demo(name, website)
where c.user_id is null
  and c.name = demo.name
  and c.website = demo.website;

-- Enforce initial review, including when a client calls the API directly.
drop policy if exists "Users can insert their own profile" on public.counselors;
create policy "Users can insert their own profile"
  on public.counselors for insert
  to authenticated
  with check (auth.uid() = user_id and approved = false);

commit;

-- Verify eight member-owned profiles; existing published profiles stay published.
select c.id, c.name, c.approved
from public.counselors c
join auth.users u on c.user_id = u.id
order by c.name;
