# Common Ground local event studio

Run `python3 local-events/server.py` from the repository, then open http://127.0.0.1:8030.

Python server, isolated Supabase Test storage (SQLite for offline unit tests), and the existing vendored Quill editor. Data survives restarts; `.env`, SQLite files and bytecode are excluded from Git. Use invented attendee details.

## Working local workflows

- Image-led event creation/editing, cover upload (JPEG/PNG/WebP ≤2 MB), formatted descriptions, start/end/timezone, online meeting link or in-person location, a live practitioner host picker and three themes.
- Public or unlisted discovery, event search and upcoming/all filtering; hide registration independently. Unlisted links still open through their URL.
- Sliding-scale EUR contributions with a minimum, suggested amount and maximum; a zero minimum allows free registration. Positive amounts start at €0.50 in this EUR prototype. Guests choose their contribution before simulated checkout. Ticket categories share this range and can have their own quantities. Existing fixed-price records remain readable until edited.
- Multiple named EUR ticket categories. One ticket per registration. Without tiers, the default event price applies. Overall and per-tier capacity both apply; if either is full the local waiting list can be used.
- Required/optional text registration questions. Answers are stored as snapshots so later edits do not erase them.
- Free registration, host approval, waiting list, approve/decline, paid checkout simulation, ten-minute payment reservations, expiry, cancellation. Approval does not reserve capacity until approved; paid approval offers a new ten-minute simulated checkout. Amounts are captured at registration, not recomputed when a host changes ticket prices.
- Host guest list with search, status filters, counts, bulk approval/decline, check-in toggles, answers, CSV and booking links.
- Manual waiting-list promotion (not automatic). Capacity checks run in a serialized database transaction to prevent last-seat races. Removing ticket types with active registrations is rejected.
- Event cloning starts hidden with no copied registrations. Cancelling an event closes it and cancels active bookings, generating email previews. It is not reversible; duplicate to start again.
- Local event links, local booking links and timezone-aware .ics downloads. Links work only on this computer while the server is running.
- Confirmation/status-change/reminder previews and guest-message previews by audience. No automatic external email.
- Resend explicit test delivery, always restricted to the configured test inbox.

## Resend

Edit `local-events/.env` (ignored by Git):

```
RESEND_API_KEY=your_key
EMAIL_DELIVERY=test
EMAIL_TEST_RECIPIENT=your_own_inbox
```

Restart the server. Sender is Common Ground <hello@common-ground.space>; the domain must be verified in Resend. Use “Send to my test inbox” in Email previews. The attendee address is never used as the delivery destination in this local test mode. EMAIL_DELIVERY=off disables sends. Accepted messages store their Resend ID; delivery to the inbox is not verified. Check Resend logs for delivery status. Never commit the real .env file.

## Boundaries

This remains a loopback-only test service. Host accounts are authenticated and scoped to assigned events, guests see only their own bookings, and public event data uses a filtered endpoint. The private schema is in Supabase Test only. Do not deploy publicly before HTTPS/Secure cookies, live payment verification and email abuse protection are implemented.

Still separate work: real Stripe Checkout/webhooks/refunds, authenticated host roles, verified attendee identity and secure self-service links, group registration, discounts/unlock codes, ticket sale windows, scheduled delivery and reminder jobs, deliverability webhooks, QR scanning/wallet passes, calendar subscriptions, recurring series, Zoom/Meet integrations, analytics, and production privacy/security controls. Payments remain simulated; no card details are collected. No automated emails are sent.

## Checks

`python3 -m unittest discover -s local-events -p 'test_*.py'`

Tests cover duplicate registrations, payment expiry, idempotent confirmation, simultaneous capacity claims, approval, waiting-list promotion, required questions, stored prices, duplication/cancellation, message previews, calendar conversion and the Resend test-recipient restriction. Browser QA covers event creation, registration questions, approval and guest management. These do not validate live Stripe or Resend delivery.

## Stripe integration decision

Stripe supports pay-what-you-want Prices through `custom_unit_amount` (`minimum`, `maximum`, `preset`): https://docs.stripe.com/api/prices/object and https://docs.stripe.com/payments/checkout/pay-what-you-want .

For this registration flow, the recommended integration is to choose an amount in Common Ground, validate and store it on the server, then create a Stripe Checkout Session using that fixed amount for this one booking. This avoids mismatches between the registration amount, approval flow and Stripe's editable amount. Zero-contribution bookings should skip paid checkout. The applicable positive minimum must be checked against the live account's currency/settlement configuration: https://docs.stripe.com/currencies .

This prototype now calls Stripe in test mode using hosted Checkout. Live payments still require verified webhooks, production operations and refund handling. “Contribution” describes event pricing; no charitable or tax-deductibility claims are made.

## Common Ground management workspace

Open `http://127.0.0.1:8030/#calendar/events`. The host workspace is tailored to
Common Ground, using Luma's separation between calendar and event management.

- Calendar: Events (upcoming/past/drafts/cancelled, search and tags), People
  (contacts, consent flag, search and CSV), Newsletters (saved drafts and preview
  scheduling), Payment (test totals, vouchers, refund policy and CSV), Insights
  (local preview views and guest feedback), Settings (tags and Resend usage).
- Event: Overview (details, practitioner hosts, invitations), Guests (approval,
  waitlist, check-in, filters and CSV), Registration (open/closed, guest names,
  custom confirmation, sliding scale, tickets and questions), Updates (drafts,
  audience selection, reminder and feedback previews), Insights, More
  (duplicate/cancel).
- No Luma membership, crypto, upsell, display/options/developer, embed, or custom
  event URL panels. No changes are made to live Luma calendars or guest data.
- Settings and drafts persist in the configured test database. Guest registration
  does not automatically subscribe people to newsletters.
- Scheduled messages/reminders are evaluated when `/api/state` is refreshed.
  They create outbox previews only, not automatic live sends. The server must be
  running and the dashboard refreshed for these local simulations to run.
- Stripe remains simulated. All real email delivery remains an explicit test
  action to `EMAIL_TEST_RECIPIENT`, never to an invitation's original recipient.
- Resend Email API Free allowance: 100/day and 3,000/month, checked against
  https://resend.com/pricing on 2026-10-22. Local successful test sends are counted
  by UTC date/month and blocked at those limits. This is not an account-wide
  usage integration; Resend remains authoritative and other apps share its quota.
  Historical sends without a timestamp cannot be included in these counters.
- Newsletter production delivery needs unsubscribe management and a deliberate
  Resend marketing/transactional integration decision; this version stores
  drafts and previews only. There are no live newsletter sends.
- This is still a **loopback-only test environment**. Do not
  deploy it or expose it publicly. Keep work on `test`.

Run tests with `python3 -m unittest discover -s local-events -p 'test_*.py'` from
repository root. Tests use temporary databases and mocked delivery, no real mail.

## Visitor event pages

`/?event=<id>` now opens a standalone visitor page instead of a dialog, with
cover artwork, practitioner portraits, date/time, event description, and an
expandable registration form. Discover and host preview actions navigate here.
`/?booking=<id>` restores the booking status, test checkout, or confirmed joining
information after refresh. The all-gatherings link returns to `/?discover=1`.
Calendar-download and online-join buttons appear in the UI after confirmation.
The server checks ownership for booking actions and calendar downloads. Online meeting links are removed from public event data until the guest is confirmed. Production still requires Stripe integration and live email delivery.

## Guest magic links and My bookings

Open `/guest.html` or use **My bookings** on visitor pages. Request a sign-in
link using your approved test email, then open it from your inbox on this laptop.
Allowlisted guests receive automatic test sign-in emails when enabled. Other
messages remain previews; explicit preview sends go only to the configured inbox. Links expire in 15 minutes and are single-use.
An explicit sign-in button redeems the link to avoid consuming it on an email
scanner's GET. Tokens are hashed in auth tables, removed from the address bar,
and sessions use HttpOnly, SameSite=Strict cookies (seven days on localhost).
The dedicated guest API returns only that email's bookings and checks ownership
before cancellation. Signing out invalidates the session server-side.

Guests now sign in before registering, using the same verified email. Host APIs require a separate host session. Production still requires HTTPS/Secure cookies and stronger abuse controls.

## Isolated Supabase test database

The `test` branch can use the separate `common-ground test` project,
reference `eicpgkmajosuhrqtrgrf` (Ireland). Production remains
`plgilmcclpldcjzkepbp`; the PostgreSQL adapter rejects that project.

Install `requirements.txt` in a local virtual environment. The default backend
remains SQLite for offline development and unit tests. After provisioning, set
`CG_EVENTS_BACKEND=supabase-test` in the ignored `local-events/.env` and restart
using `.venv/bin/python server.py`. Unknown backend names fail instead of silently
using another database.

Provisioning requires an `event_tool_app` database login (no superuser, role
creation, database creation, or replication privileges) and a private `event_tool`
schema with USAGE and CREATE granted to that login, with no grants to `anon`, `authenticated`, or PUBLIC.
Store its connection configuration in
`~/.config/common-ground/event-test-database.json`, mode 600, containing
`project_ref`, `host`, `user`, and `password`. Use the test project's transaction
pooler, username `event_tool_app.eicpgkmajosuhrqtrgrf`, and host
`aws-0-eu-west-1.pooler.supabase.com`. The management access token is used only for
setup, never by the running web server or browser. No production users, bookings,
or passwords are copied.

The adapter uses a real PostgreSQL transaction per request and a transaction-level
advisory lock to preserve the prototype's serialized capacity checks, one-time
magic links and scheduled previews. This is appropriate for this small test, not
a high-throughput deployment design. The server remains loopback-only; host APIs now require authenticated accounts. Email preview and
simulated payment behavior are unchanged. SQLite data is retained locally.

Current status: the test role and schema are provisioned. The local server uses
Supabase Test. The host picker reads a test snapshot of seven public practitioner
names and photo URLs; production accounts and bookings were not copied. Original
SQLite demo data remains available by selecting the sqlite backend. The database
contains a fresh sample event. Guest sign-in remains the prototype magic-link
implementation (not Supabase Auth); transactional emails can use the allowlisted automatic delivery described below.


## Host sign-in and permissions

Use `/host.html`. The test administrator is `nicolomantini@gmail.com`; its generated
password is stored only at `~/.config/common-ground/test-admin-password` (mode 600).
Host passwords are salted/scrypt-hashed; session tokens are hashed, expire in eight
hours, and use HttpOnly/SameSite cookies. Five failed attempts lock an email for
15 minutes. This custom test authentication is not Supabase Auth.

Administrators use **Host access** (`/hosts.html`) to add a host email, link it to
a practitioner, set a test password, or disable access. Account updates revoke
existing sessions. Admin access cannot be edited from that form. Ordinary hosts
see only assigned events, guests, campaigns and event insights. Event changes,
including updates and guest actions, check assignment on the server. New events
must include their creator as a host. Calendar settings, contacts, discounts,
account management, email previews and explicit test sends are administrator-only.

`/api/public-state` never returns the email outbox or unrelated bookings. Guest
registration requires the signed-in guest's email. Calendar downloads require a
confirmed booking or event-host access. No account passwords or sessions from
production have been copied. Guest magic-link and booking-status emails now use the automatic test delivery
flow described below when the recipient is allowlisted.


## Automatic transactional test email

The local `.env` can enable `EMAIL_AUTOMATIC=test`, `EMAIL_DELIVERY=test`, and
`EMAIL_TEST_ALLOWLIST` (comma-separated exact email addresses). The current local
allowlist is `nicolomantini@gmail.com`. New guest sign-in and booking-status emails
are queued in the test database and sent to their actual recipient only when
allowlisted. They are never redirected to someone else's test inbox. Other
addresses are rejected by the sign-in request endpoint. Old email previews,
invitations, reminders, and newsletters are not automatically sent.

The background worker runs while the local server is running. It checks the
outbox every five seconds, sends after the booking transaction commits, and uses
a stable Resend idempotency key. Failures retry up to five attempts with exponential
backoff. No retry is made beyond 20 hours from queue creation, inside Resend's
24-hour idempotency retention. Expired/replaced/used sign-in links are suppressed.
Restarting the server resumes eligible queued messages. Outbox statuses distinguish
queued, retry, accepted, failed, expired, and blocked. Accepted means accepted by
Resend, not independently confirmed inbox delivery.

The local quota guard counts accepted and possibly accepted attempts toward
100/day and 3,000/month, including manual sends in this database. It cannot see
usage by other projects sharing the Resend account; Resend enforces account limits.
The allowlist is checked again immediately before every send. No production
website or Supabase project was changed. Links still use localhost, so open them
on the laptop running the server. SMTP/Supabase Auth and external hosting are
not part of this test. Guest accounts are the existing custom magic-link flow.


## Stripe test Checkout

Set `STRIPE_MODE=test` and save a test-only `sk_test_` secret in
`~/.config/common-ground/stripe-test-key` (mode 600). The server rejects live keys
and live Checkout sessions. The browser never receives the secret. Paid bookings
use Stripe-hosted card Checkout with the contribution already validated and stored
on the server. Zero contributions bypass Stripe. Approval/waitlist guests only
receive a checkout after a place is offered. The simulated-payment HTTP shortcut
and host bulk `pay` action are disabled.

A Checkout intent and immutable payload are committed before the Stripe API call.
Retries use the same booking idempotency key. Sessions expire after about 31 minutes;
bookings with Stripe intents are not released by the old ten-minute local expiry.
The local background reconciler checks pending Stripe bookings every 30 seconds,
including after browser closure or server restart. Only a test-mode, paid session
with matching booking metadata, EUR currency and exact amount confirms a booking.
No browser-supplied payment status or return URL can confirm it. Confirmation
emails use the existing allowlisted outbox. Failures retain the seat while their
payment status is uncertain. Intents older than 20 hours without a saved session
require administrator review, avoiding reuse outside Stripe's idempotency window.

Cancelling expires an open Checkout before releasing the seat; a racing paid
response is reconciled first. Eligible cancellations now queue a full refund under the policy below. There are no real payments in this environment.

This localhost integration uses server polling rather than public Stripe webhooks.
Before deployment, add a signed webhook endpoint and production-ready background
processing. Polling runs only while this local server is running. A Stripe outage
keeps uncertain reservations held rather than risking overselling.


## Automatic cancellation refunds (test mode)

The fixed cancellation policy grants a full refund for paid guest cancellations
at least 48 hours before the event start, including exactly 48 hours. The cutoff
uses the event timezone converted to UTC, including DST. Late cancellations are
non-refundable; guests are advised to contact the host before cancelling if they
want to transfer their place. Transfers are host-arranged, not a self-service flow.
Host cancellation of the event queues full refunds regardless of the cutoff,
including paid registrations that were previously cancelled without a refund.

Cancellation time/reason and a durable refund job are committed together. A worker
then verifies the Stripe test PaymentIntent and requests the full stored amount
with a stable booking-specific idempotency key. Processing is deferred until the
database transaction commits, retries persist across restarts, and ambiguous
requests older than 20 hours require host review. Stripe pending refunds are
polled and not shown as completed. Failures/requires-action are visible in guest
and host views; the application does not automatically create a second refund.
Only confirmed Stripe success queues the refund-confirmation email. Local polling
runs while the server runs. Old cancellations without a recorded cancellation
time are not automatically backfilled.
