# Homepage events

The homepage reads the public Common Ground Luma iCal feed through `/api/luma-events`. `netlify.toml` routes that path to `netlify/functions/luma-events.cjs`, which fetches the feed and public event pages; no API key or paid Luma API is required. This route works on Netlify, or with `netlify dev`, not a plain static file server.

`js/luma-calendar.js` unfolds iCal lines, reads the UTC timestamps emitted by Luma, excludes past/started and cancelled events, sorts by start time, and returns the next three. Unsupported dates are skipped rather than displaying guessed times. Cards display Europe/Zurich time, including daylight-saving changes. Registration links are restricted to HTTPS Luma URLs and open in a new tab. Calendar text is inserted with `textContent`.

The feed provides titles, dates, hosts and links. The server enriches each of the next three events with its original cover from public Schema.org Event metadata, falling back to the Open Graph sharing image. Only HTTPS images on images.lumacdn.com are accepted. Each page fetch has a five-second timeout; if metadata is unavailable the event still renders with a branded placeholder. Responses are cached for up to five minutes at the CDN. Cards use the original vertical layout with a 16:9 image preview, a short description from public event metadata, and a host footer. Host photos are matched by name from the public practitioner directory when available. Empty/error states retain the full-calendar link. The old Supabase event records are not used or modified.

Verify parser behavior with `node --test tests/luma-calendar.test.cjs tests/luma-events.test.cjs`. Changes made in Luma appear after its feed/CDN cache refreshes and the homepage reloads.
