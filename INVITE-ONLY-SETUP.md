# Common Ground — onboarding the eight members

Membership is a fixed group of eight people. There is no public application or
self-signup form. Each member uses their own account and chooses their own password.
There is no need to build an application review system or an automated eight-seat limit.

## Before sending invitations

- Deploy the current website at a public address. A localhost address is only for
  testing on your own computer; members cannot use it to reach your site.
- In Supabase Authentication settings, disable new public signups. Removing the
  form does not disable the signup API.
- Configure invitation links to land at the deployed `/auth.html` page, and add
  that exact address to Supabase's allowed redirect URLs. The intended address
  is `https://common-ground.space/auth.html`, once this domain serves the app.
- Check the invitation email template and default Site URL. Invitations without
  an explicit redirect use the configured Site URL; they must not land on the
  homepage or the GoDaddy holding page. For dashboard-generated invitations,
  ensure their default destination is the deployed `/auth.html` page.
- Apply `supabase/require-profile-review.sql` in the SQL Editor to enforce review
  on newly created profiles. The main schema includes this rule for fresh setups.
- Check which members already have accounts before inviting them again. Existing
  members can log in or use the password-reset link.

## Invite a member

1. Open Supabase → Authentication → Users.
2. Choose the option to invite a user by email.
3. Enter the member's confirmed email address and send their personal invitation.
4. The member follows the link, chooses a password, and reaches their profile page.
5. They add their name, introduction, photo, languages, approach, and contact links.
6. Saving creates a profile marked **Pending review**.
7. Review the profile in Table Editor → counselors and set `approved` to `true`
   when it is ready to publish.

Approved members can edit their own profile. Later edits currently go live
immediately; they do not go back into review.

## Test one invitation before inviting the rest

Use an email address you control. Confirm that the invitation opens the password
form, profile saving works, an unapproved profile stays off the public directory,
and the profile appears after approval. Test logout, login, and password reset.
Do not change someone else's password or use one shared password for the group.

No invitations or database changes are made by editing this repository. Invitations,
redirect settings, and applying the SQL patch are separate Supabase actions.

The old `signup_requests` table and its setup script can remain unused; no existing
requests are deleted by this change.

Reference: https://supabase.com/docs/guides/auth/redirect-urls
