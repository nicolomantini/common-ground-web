# Code review and improvement plan

Reviewed 26 October 2026. User approved this plan for main and test.
Keep the public site lightweight; no framework rewrite is required.

## Environment rules

- main is the live website; test is the separate event-tool environment.
- Never merge test wholesale into main: database settings, payment mode and deployment configuration differ.
- Keep production data and credentials separate. Do not copy production secrets into test.
- Push only when requested; GitHub triggers Netlify deployments. No manual deployment needed.

## Work order and acceptance criteria

1. **Safe practitioner rendering — both branches.** Escape all profile/review text and attributes; validate photo and WhatsApp URLs. Include hostile input regression tests and preserve normal display and links.
2. **Event images and queries — test.** Move inline image data to test Supabase Storage, preserve existing covers through a migration, store URLs and generate appropriately sized previews. Replace whole-table reads with explicit columns, SQL filters, pagination and aggregate counts. Keep host permissions and private meeting links protected. Measure payload sizes before/after.
3. **Database concurrency and email — test.** Separate read-only queries from writes. Replace the shared global lock with narrowly scoped booking/event locks. Claim queued emails atomically and send outside transactions, preserving idempotency, quotas and retries. Test concurrent registration, capacity, payments and refunds before removing existing protection.
4. **Architecture — test first.** Use one backend locally and on Netlify; retire the duplicate Python implementation only after feature parity. Unify practitioner authentication with Supabase, preserving guest magic links and host/admin permissions. Replace build-time string substitutions with explicit environment config/templates. Format source for maintainability.
5. **Blog listing — both branches.** Fetch summaries only, fetch full bodies on article pages, add pagination and appropriate search/filter behaviour. Preserve poetry formatting, cover images and existing URLs.
6. **Caching — test.** Keep private/API responses uncached. Add versioned static assets and appropriate browser caching, proving that deployments cannot leave stale JS/CSS combinations.

## Progress

- Review complete: source inspection, not a browser benchmark or exhaustive security audit.
- Baseline: 8 JavaScript test files and 67 Python tests passed.
- Step 1 complete: profile cards, specialty filters and reviews escape user text; photo protocols and WhatsApp numbers are validated. Regression tests cover hostile input and normal links. Applied locally to main and test; not pushed.
- Validation: all 5 website JavaScript test files pass, including the new profile-rendering regression test; JavaScript syntax check passes.
- Step 2 loading improvements complete locally on test: separate versioned image endpoint instead of inline base64 in state/booking JSON; public covers may be browser-cached for 5 minutes, restricted covers remain uncached and permission-checked. Editing retains existing covers; arbitrary image URLs are rejected.
- Homepage requests 3 upcoming summaries. /events requests 50 summaries per page with Show more, server-side period/date filters and calendar markers across the full selected period. Detail requests select the requested event. Host/guest rows are filtered in SQL and reservation counts use one grouped query instead of one query per event.
- Step 2 remaining/deferred: move cover bytes into Supabase Storage, migrate existing images and generate resized previews. Current change deliberately preserves image storage and schema. Admin dashboard still retrieves its complete metadata collections; incremental admin endpoint/pagination work belongs with the later backend changes.
- Validation: test build and all 5 event-tool test files pass; all 5 website test files pass. New regressions cover private-image denial, image versioning, cover retention when editing, bounded summary queries, calendar pagination and hidden meeting links. Read-only test-database checks validated public, detail, practitioner-host and admin SQL. Current fixture contains one public event and no cover bytes, so no real-world image performance claim is made; homepage summary response was 575 bytes including date markers.
- User requested stopping before backend work. Database locking, email delivery, backend consolidation and authentication are unchanged. No database migrations or writes performed; no push/deploy.
- Resume with the deferred storage work only when authorised, then step 3 concurrency tests before replacing the global lock. Steps 4–6 remain pending.

## Follow-up checks

Measure homepage and event-page requests, transfer size, mobile loading and repeat visits. Consider a dedicated public build directory on main and a last-known-good Luma event cache. Do not claim unmeasured speed gains.
