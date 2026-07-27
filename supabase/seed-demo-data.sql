-- Run this in Supabase → SQL Editor to add 5 sample counselor profiles.
-- These are approved=true right away (no review step needed) and have no
-- linked account (user_id is null) — they're admin-added demo data, not
-- owned by any counselor login. A counselor can't edit these; if you want
-- one of them to become a "real" login-owned profile later, either delete
-- it and have the counselor sign up fresh, or manually set its user_id to
-- their auth.users id once they've signed up.

insert into public.counselors
  (name, pronouns, location, specialties, approach, formats, languages,
   session_length, price_range, availability, bio, focus, website, approved)
values
(
  'Maya Ortiz', 'she/her', 'Austin, TX',
  array['Anxiety', 'Relationships'], array['CBT', 'Emotionally Focused'],
  array['Video', 'In-person'], array['English', 'Spanish'],
  '50 min', '$$', 'Accepting new clients',
  'Maya works with people who feel like their anxious thoughts are running the show. She''s direct, warm, and big on practical tools you can use between sessions — not just talk.',
  'Helps clients build a calmer relationship with worry, and works with couples navigating conflict or disconnection.',
  'https://mayaortizcounseling.example.com', true
),
(
  'Dwayne Fisher', 'he/him', 'Colorado Springs, CO',
  array['Trauma', 'Veterans'], array['EMDR', 'Somatic'],
  array['Video', 'Phone'], array['English'],
  '50 min', '$$', '1 opening this month',
  'Dwayne is a former Army medic who now specializes in trauma recovery, with a particular focus on veterans and first responders. Sessions are steady, unhurried, and grounded in the body as much as the mind.',
  'Works with PTSD, combat trauma, and the friction of returning to civilian life.',
  'https://dwaynefishertherapy.example.com', true
),
(
  'Priya Nair', 'she/her', 'San Francisco, CA',
  array['Couples', 'Family'], array['Gottman Method', 'Systemic'],
  array['Video', 'In-person'], array['English', 'Hindi'],
  '60 min', '$$$', 'Accepting new clients',
  'Priya has spent fifteen years helping couples and families untangle the same argument they keep having. She''s known for asking the question nobody else in the room wants to ask.',
  'Especially experienced with intercultural couples and multigenerational family friction.',
  'https://priyanairphd.example.com', true
),
(
  'Sam Okafor', 'they/them', 'Chicago, IL',
  array['Teens', 'ADHD'], array['CBT', 'Strengths-based'],
  array['Video'], array['English'],
  '45 min', '$', 'Accepting new clients',
  'Sam works mostly with teenagers and young adults, and it shows — sessions feel more like a real conversation than a lecture. A lot of clients come in for ADHD and stay because they finally feel understood.',
  'Comfortable working with school stress, executive function, and the general chaos of being a teenager right now.',
  'https://samokaforcounseling.example.com', true
),
(
  'Elena Voss', 'she/her', 'Portland, OR',
  array['Grief', 'Life transitions'], array['Narrative', 'Person-centered'],
  array['In-person'], array['English', 'German'],
  '50 min', '$$', 'Waitlist',
  'Elena''s practice is built around the idea that grief doesn''t move in a straight line, and that''s fine. She sits with hard things well and rarely rushes toward silver linings.',
  'Supports loss of a loved one, divorce, retirement, and other big life turns.',
  'https://elenavosstherapy.example.com', true
);
