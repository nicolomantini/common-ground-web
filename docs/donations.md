# Production donations

The homepage Donate button links to `/donate/`. The slider starts at €100 and
supports €1, then €5 increments through €1,000. No account is required.
The Netlify function `netlify/functions/donate.cjs` creates a one-time Stripe
Checkout session, tagged `purpose=common-ground-donation`. Payments are visible
in the Common Ground Stripe dashboard; they do not create event bookings.

## Required production configuration

On the Netlify **common-ground-site** project, add `STRIPE_SECRET_KEY` with the
Common Ground account's `sk_live_…` key as a standard environment variable in the
**Production** deploy context (compatible with Netlify Free). Store the key only in Netlify, never in Git,
HTML, frontend JavaScript or chat. Redeploy after changing environment variables.
Production accepts only live keys and live checkout sessions. Return URLs are
fixed to https://common-ground.space/donate/.

Configured through the Netlify API on 2 November 2026, after user approval,
using the standard Free-plan scopes and Production context. A GitHub deployment
is still needed to publish the donation code. Live payments have not been verified.
No live payment has been made during development.

The server validates amounts and request origin; repeated submissions reuse a
Stripe idempotency key. The return page verifies payment status with Stripe.
A success URL alone does not mean payment succeeded. No automated donor emails,
booking refunds or fulfilment actions are attached to donations.

The test branch retains its own test-only donation function and test keys.
Do not merge the event-tool backend or database configuration into main.

## Local credential file

Use the repository-root `.env` file for the production `STRIPE_SECRET_KEY`.
An empty `.env.example` documents the name. `.env` and `.env.*` are ignored by
Git; the actual file is readable/writable only by its owner. Never force-add it.
After filling it, the key can be copied to Netlify's production environment
configuration via its API. A local `.env` does not automatically configure Netlify.

Production builds now run `node scripts/build-site.cjs` and publish `site-build/`.
Only website assets are copied; `.env`, backend source, scripts and database files
are excluded. Deploy the generated folder, not the repository root.
