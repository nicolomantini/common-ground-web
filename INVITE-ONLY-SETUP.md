# Invite-only access — setup

Signup is now request-based: visitors submit a request, you review it, and only people
you invite can actually create a login. This closes the previous open-signup gap.

## 1. Run the new table setup
Supabase → **SQL Editor** → paste and run `supabase/signup-requests.sql`.
This creates `signup_requests`, where "I'd like to join" submissions land — no login
account is created at this stage, it's just a form entry only you can see.

## 2. Turn off public self-signup (important)
This is the step that actually closes the loophole — without it, a technically-inclined
visitor could still call the sign-up API directly and create an account, bypassing your
review entirely.

1. Supabase → **Authentication → Providers → Email**
2. Toggle **off** "Allow new users to sign up" (wording may vary slightly by dashboard
   version — look for a setting about disabling/restricting new signups)
3. Save

With this off, the only way an account gets created is through the invite flow below.

## 3. Reviewing and approving requests
1. Supabase → **Table Editor → signup_requests**
2. Look through pending rows — name, email, and their optional message
3. Decide: approve or ignore/delete the row

## 4. Inviting an approved person
1. Supabase → **Authentication → Users**
2. Click **Add user → Invite user** (or **Invite** — wording varies by dashboard version)
3. Enter their email → send
4. They receive an email with a link to set their password
5. Once they set it, they can log in at `auth.html` → **Log in** tab, and land on the
   dashboard to create their profile — same as before, nothing changed on that end

Optional housekeeping: update that row's `status` column in `signup_requests` from
`pending` to `invited` so you can track who's been handled, or just delete the row —
either is fine, it's just for your own reference.

## What changed in the code
- `auth.html` / `js/auth.js` — the old "Sign up" tab (which created an account directly)
  is now "Request access" (which only submits a request for you to review)
- Nothing changed in `dashboard.html` / `js/dashboard.js` — once someone logs in via an
  invite, profile creation works exactly as before

## Push it
```bash
cd ~/repo/counselor-site
git add .
git commit -m "Switch to invite-only access: request form + admin approval"
git push
```
