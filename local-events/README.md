# Common Ground local event studio

Run `python3 local-events/server.py` from the repository, then open http://127.0.0.1:8030.

Python standard-library server, SQLite storage, and the existing vendored Quill editor. No Supabase changes. Data survives restarts; `.env`, SQLite files and bytecode are excluded from Git. Use invented attendee details.

## Working local workflows

- Image-led event creation/editing, cover upload (JPEG/PNG/WebP ≤2 MB), formatted descriptions, start/end/timezone, online meeting link or in-person location, a live practitioner host picker and three themes.
- Public or unlisted discovery, event search and upcoming/all filtering; hide registration independently. Unlisted links still open through their URL.
- Sliding-scale EUR contributions with a minimum, suggested amount and maximum; a zero minimum allows free registration. Positive amounts start at €0.50 in this EUR prototype. Guests choose their contribution before simulated checkout. Ticket categories share this range and can have their own quantities. Existing fixed-price records remain readable until edited.
- Multiple named EUR ticket categories. One ticket per registration. Without tiers, the default event price applies. Overall and per-tier capacity both apply; if either is full the local waiting list can be used.
- Required/optional text registration questions. Answers are stored as snapshots so later edits do not erase them.
- Free registration, host approval, waiting list, approve/decline, paid checkout simulation, ten-minute payment reservations, expiry, cancellation. Approval does not reserve capacity until approved; paid approval offers a new ten-minute simulated checkout. Amounts are captured at registration, not recomputed when a host changes ticket prices.
- Host guest list with search, status filters, counts, bulk approval/decline, check-in toggles, answers, CSV and booking links.
- Manual waiting-list promotion (not automatic). Capacity checks run in a SQLite write transaction to prevent last-seat races. Removing ticket types with active registrations is rejected.
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

This is not full Luma parity or a production service. There is no authentication or isolation between visitors and hosts: all demo data is available to anyone using this local server. Booking UUIDs and unlisted URLs are conveniences, not production access controls. Calendar downloads include the entered location. Host selection reads approved public profiles from Common Ground using the existing public Supabase key; the source site is never modified. Selection does not authenticate the local host or grant production permissions. Server binds only to loopback and rejects cross-origin writes. Do not deploy it or use real attendee data.

Still separate work: real Stripe Checkout/webhooks/refunds, authenticated host roles, verified attendee identity and secure self-service links, group registration, discounts/unlock codes, ticket sale windows, scheduled delivery and reminder jobs, deliverability webhooks, QR scanning/wallet passes, calendar subscriptions, recurring series, Zoom/Meet integrations, analytics, and production privacy/security controls. Payments remain simulated; no card details are collected. No automated emails are sent.

## Checks

`python3 -m unittest discover -s local-events -p 'test_*.py'`

Tests cover duplicate registrations, payment expiry, idempotent confirmation, simultaneous capacity claims, approval, waiting-list promotion, required questions, stored prices, duplication/cancellation, message previews, calendar conversion and the Resend test-recipient restriction. Browser QA covers event creation, registration questions, approval and guest management. These do not validate live Stripe or Resend delivery.

## Stripe integration decision

Stripe supports pay-what-you-want Prices through `custom_unit_amount` (`minimum`, `maximum`, `preset`): https://docs.stripe.com/api/prices/object and https://docs.stripe.com/payments/checkout/pay-what-you-want .

For this registration flow, the recommended integration is to choose an amount in Common Ground, validate and store it on the server, then create a Stripe Checkout Session using that fixed amount for this one booking. This avoids mismatches between the registration amount, approval flow and Stripe's editable amount. Zero-contribution bookings should skip paid checkout. The applicable positive minimum must be checked against the live account's currency/settlement configuration: https://docs.stripe.com/currencies .

This prototype does not call Stripe, create Prices, or process donations/payments. A real integration still needs a test secret key, authenticated server routes, idempotent session creation, verified payment webhooks and refund handling. “Contribution” describes event pricing; no charitable or tax-deductibility claims are made.
