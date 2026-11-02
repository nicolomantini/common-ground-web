# Production donations

The homepage Donate button links to `/donate/`. The slider starts at €100 and
supports €1, then €5 increments through €1,000. No account is required.
The Netlify function `netlify/functions/donate.cjs` creates a one-time Stripe
Checkout session, tagged `purpose=common-ground-donation`. Payments are visible
in the Common Ground Stripe dashboard; they do not create event bookings.

## Required production configuration

On the Netlify **common-ground-site** project, add `STRIPE_SECRET_KEY` with the
Common Ground account's `sk_live_…` key, scoped to **Functions**, in the
**Production** deploy context. Store the key only in Netlify, never in Git,
HTML, frontend JavaScript or chat. Redeploy after changing environment variables.
Production accepts only live keys and live checkout sessions. Return URLs are
fixed to https://common-ground.space/donate/.

As checked on 2 November 2026, this production key is not configured. Checkout
will report that donations are unavailable until it is set. Do not describe
live payments as verified until configuration and a real end-to-end check occur.
No live payment has been made during development.

The server validates amounts and request origin; repeated submissions reuse a
Stripe idempotency key. The return page verifies payment status with Stripe.
A success URL alone does not mean payment succeeded. No automated donor emails,
booking refunds or fulfilment actions are attached to donations.

The test branch retains its own test-only donation function and test keys.
Do not merge the event-tool backend or database configuration into main.
