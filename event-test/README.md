# Common Ground — hosted event test

This is the Netlify adapter for the event tool on `test`. The live website and its root Netlify configuration are separate.

- Test project: `common-ground-test`
- Netlify site ID: `b8ffa636-cb85-4b92-ad68-d21ae2ced2f8`
- Host sign-in: https://common-ground-test.netlify.app/host.html
- Public gatherings: https://common-ground-test.netlify.app/?discover=1
- Guest bookings: https://common-ground-test.netlify.app/guest.html
- Supabase test project: `eicpgkmajosuhrqtrgrf`, private `event_tool` schema

## Architecture

Browser assets are explicitly copied from `local-events/` by `build.mjs`. Node server functions implement authenticated API routes; scheduled functions retry email delivery, reconcile Stripe Checkout, process refunds and create scheduled message previews. No local server is required after deployment. The database is shared with the local prototype, not production.

Database transactions use the same advisory lock as the Python prototype. The database connection verifies Supabase's TLS certificate. Database access is restricted to the test application role; no Supabase management token is deployed.

Stripe keys must be test keys. Checkout amounts are calculated server-side and confirmed against Stripe. Signed checkout webhooks provide immediate confirmation; the scheduled payment worker is a fallback. Full eligible refunds run automatically, usually within five minutes. Refund retries and messages use stable idempotency keys.

Guest links are single-use, expire after 15 minutes and set secure cookies. Host accounts use the existing test administrator password. Event hosts can manage only events assigned to them; administrator privileges are required for calendar-wide contacts, settings and previews.

## Testing limits

- Automatic emails only go to `EMAIL_TEST_ALLOWLIST` (currently the administrator).
- Invitations, newsletters, reminders and updates remain previews. An administrator can send an individual preview to the configured allowlisted test inbox.
- Email allowance checks count this tool's sends, not all activity in the Resend account.
- Scheduled workers process bounded batches. This is a small test environment, not a production-scale launch.
- Self-service transfer of a booking is not implemented; hosts arrange transfers.
- The site is public, with search indexing disabled. Host and booking information require authentication.
- GitHub pushes to `test` automatically build this site; production remains on `main`.

## Environment variables

Set these on **the test site only**, never in browser code or committed files:

`CG_TEST_PROJECT`, `PGHOST`, `PGUSER`, `PGPASSWORD`, `SITE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_TEST_ALLOWLIST`, `EMAIL_TEST_RECIPIENT`.

The database guard accepts only the designated test project/user/host. `SITE_URL` must use HTTPS on a Netlify subdomain. The Stripe webhook endpoint is `/api/stripe-webhook`, with Checkout completion, expiration and asynchronous payment result events.

## Build and deploy

From this directory:

```sh
npm ci
npm test
npm run build
netlify deploy --site b8ffa636-cb85-4b92-ad68-d21ae2ced2f8 --prod --no-build --dir public --functions functions
```

`--prod` publishes the primary URL of **this separate test site**. Always keep the explicit test site ID. Do not use the live Common Ground site ID.

`tests/database-check.mjs` exports an optional test-database integration check. It runs temporary fixtures within a transaction and rolls them all back. Never configure it with production credentials.

## Complete website test deployment

The root URL now publishes the full website, including practitioner profiles, blog,
authentication, dashboard, reviews and feedback forms. `build.mjs` copies an explicit
allowlist of static files and replaces the browser Supabase configuration with
`site/test-config.json`. The latter contains only the **public anonymous key** for
the test project. Builds reject production project references and privileged keys.
Analytics is disabled and indexing is blocked. The event tool lives at `/event-tool/`; its API remains at `/api/`.
Old host/guest links redirect to their new locations.

- Full site: https://common-ground-test.netlify.app/
- Practitioner sign-in: https://common-ground-test.netlify.app/auth.html
- Event dashboard: https://common-ground-test.netlify.app/event-tool/#calendar/events
- Guest bookings: https://common-ground-test.netlify.app/event-tool/guest.html

The test project has the same public website tables and row-level access rules,
plus the private `event_tool` schema. The initial public snapshot contains seven
approved profiles, three published posts, three event links and thirteen copied
images. Private production submissions, unpublished content and production login
accounts were not copied. The administrator has a separate Supabase test account
using the existing saved test password; the event host account retains that password
as well. These currently have separate sign-in sessions.

The homepage previews native test events. Imported legacy event links are retained
in the test database; they do not create real registrations or duplicate native
bookings. Practitioner changes are reflected in the hosted event host picker.

To initialize another copy of **this test project only**, use the local Python
virtual environment and the guarded preparation script:

```sh
local-events/.venv/bin/python event-test/scripts/prepare-website.py --schema --content --auth
```

It reads existing credentials from `~/.config/common-ground/`, reads production
content only through anonymous public GET endpoints, and writes only to the fixed
test project. Do not rerun content copying casually after editing test content;
existing rows are preserved, but copied media and the host snapshot are refreshed.

For local review of the **full isolated website**, build and serve `event-test/public`
(with Netlify Dev for the API), not the repository root: the shared source's browser
configuration remains production-oriented until the test build replaces it.
Future release work should promote reviewed code and schema migrations, not overwrite
production data with this snapshot. The root `netlify.toml` on `test` builds from `event-test/`. Never promote that
test-only deployment configuration to `main` without reviewing production settings.

### Practitioner test access

The seven copied approved practitioners now have individual Supabase test accounts
linked to their profiles, plus event-host accounts linked to the same practitioners.
Only Nico remains an administrator. Their initial passwords are stored privately in
`~/.config/common-ground/test-practitioner-logins.txt` (owner-only permissions),
not in this repository. Share each person only their own entry. No invitations were
sent and no production credentials were changed. Practitioner sign-in is available in the website footer.
Profile and event-host passwords/sessions are still separate; changing the profile
password does not change the event-host password. Guest email testing remains restricted.

`event-test/scripts/enable-practitioners.py` provisions these explicit members only,
preserves existing accounts/passwords, and refuses conflicting profile ownership.

### Public event calendar

`/events` is the public timeline with a month calendar, selectable dates and Upcoming/
Past filters. `/event` redirects there. Cards use published public native events
from the test API; unlisted, cancelled and draft events are excluded. Host portraits
come from the test practitioner directory. Registration still opens the event tool's
existing booking page. Source files are `site/event.html`, `site/events.css` and
`site/events.js`; the test build installs them separately from production pages.

Normal updates: commit and push to `test`. Netlify builds and publishes automatically.
Do not include `[skip netlify]` in commits intended for deployment. Manual CLI deployment
is reserved for troubleshooting.

Automatic builds use the existing GitHub App connection. The test site's production
branch and allowed branch list are both `test`; changes to `main` do not deploy here.
Check build progress at https://app.netlify.com/projects/common-ground-test/deploys.

## Homepage donations (test only)

The test build adds a Donate header button and `/donate/`. Visitors can give a
one-time EUR contribution without an account using a €1–€1,000 slider starting at €100: €1, then €5, €10, €15 and so on up to €1,000.
The chosen amount is displayed as the slider moves. The server validates the amount and creates a
Stripe-hosted checkout using the existing `STRIPE_SECRET_KEY` and `SITE_URL`.
Only `sk_test_` keys and non-live Checkout sessions are accepted.

Donations are separate from event bookings. Stripe Checkout and PaymentIntent
metadata use `purpose=common-ground-donation`; review them in Stripe's test
dashboard. No booking, registration email or event cancellation/refund policy
is created or applied. The return page checks the session with Stripe before
showing payment success. Session creation retries use an idempotency key.

Validation: build and six event-tool test files passed; a €5 Stripe test session
was created, retried without duplication, verified as unpaid, and expired.
No payment was made. This feature is not included in the main website build.
