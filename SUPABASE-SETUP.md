# Counselor self-editing — Supabase setup

Counselors can now sign up, create their own profile, upload their own photo, and edit it
any time — without touching GitHub or code. New profiles are hidden from the public
directory until you approve them (see "Approving a new profile" below).

## New files
```
supabase/schema.sql     Run this once in Supabase to set up the database
js/supabase-client.js   Your project's connection details go here
auth.html + js/auth.js       Counselor sign-up / login page
dashboard.html + js/dashboard.js   Counselor's "edit my profile" page
```
`js/counselors-data.js` is no longer used by the live site (data now lives in Supabase) —
you can delete it, or keep it around for reference.

## 1. Create a free Supabase project
1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New project**.
2. Pick a name, a database password (save it somewhere), and a region close to your users.
3. Wait ~2 minutes for it to finish provisioning.

## 2. Run the database setup script
1. In your Supabase project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this project, copy the whole file, paste it in, and click **Run**.
3. This creates the `counselors` table, the security rules that let a counselor edit only
   their own profile, and a `photos` storage bucket for headshots.

## 3. Connect the site to your project
1. In Supabase: **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key (NOT the `service_role` key — never
   put that one in frontend code).
3. Open `js/supabase-client.js` and paste them in:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```

## 4. Email confirmation setting (recommended for now)
By default, Supabase requires a counselor to click a confirmation link in their email
before they can log in. For a small/simple setup you can turn this off:
- **Authentication → Providers → Email → toggle off "Confirm email"**

You can turn it back on later once you've set up a custom email domain if you'd like the
extra verification step.

## 5. Try it
1. Push these changes and let Netlify redeploy (see commands below).
2. Visit your site → **Counselor login** → **Sign up** with a test email/password.
3. You'll land on the dashboard — fill in the profile form, upload a photo, **Save**.
4. It'll say **"Pending review"** — that's expected, see next step.

## Approving a new profile
New and edited profiles are NOT visible to visitors until you approve them — this stops
anyone from publishing something straight to your live site unreviewed.

To approve:
1. In Supabase: **Table Editor → counselors**.
2. Find the row, check its contents look right.
3. Click into the **approved** column for that row and set it to `true`.
4. It appears on the live directory within a few seconds (no rebuild needed — the site
   reads live from the database).

Editing an already-approved profile does **not** un-approve it — a counselor's normal edits
go live immediately without needing re-review. Only brand-new profiles start unapproved.

## What counselors can and can't do
- ✅ Sign up, log in, create their own profile, edit it any time, upload/replace their own photo
- ✅ See their own "Pending review" / "Live on the site" status on their dashboard
- ❌ Cannot see or edit anyone else's profile
- ❌ Cannot approve their own profile (enforced by the database itself, not just the app —
  even a technical user couldn't bypass this from the browser)

## Adding sample/demo profiles (optional)
Want a few profiles on the site right away, without waiting for real counselors to sign up?
1. If your project already ran the original `supabase/schema.sql`, first run
   `supabase/allow-null-user-id.sql` once (new projects don't need this — it's already
   built into the current `schema.sql`).
2. Then run `supabase/seed-demo-data.sql` in the SQL Editor — it adds 5 sample profiles,
   already approved, so they show up on the directory immediately.
3. These demo profiles aren't linked to a real login, so no one can edit them through the
   dashboard — that's expected. Edit them directly in **Table Editor → counselors** any time,
   or delete them once real counselors have signed up.

## Push to GitHub / Netlify
Same as before — no new Netlify settings needed, this is all plain static files calling
Supabase directly from the browser:
```bash
cd ~/repo/common-ground-web
git add .
git commit -m "Add counselor self-signup and profile editing via Supabase"
git push
```

## Costs
Supabase's free tier includes 500MB database storage, 1GB file storage, and 50,000 monthly
active users — comfortably enough for a small practice. No credit card required to start.
