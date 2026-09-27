# Common Ground — counselor directory site

A simple, static, responsive site where visitors can browse counselors, filter by
specialty / format / language, and book directly with a practitioner. No backend or build step required —
plain HTML, CSS, and JS.

Planned production URL: https://common-ground.space

## Project structure
```
index.html          Page markup (hero, filters, directory, booking links)
css/styles.css       All styling
js/counselors-data.js  Counselor data — edit this to add/remove/update counselors
js/app.js            Rendering, filtering, and booking-form logic
netlify.toml         Netlify build/publish config
```

## Editing counselors
Open `js/counselors-data.js` and edit the `COUNSELORS` array. Each counselor is a plain object
— add a new one by copying an existing entry and giving it a unique `id` and `seed` (any integer;
it controls their generated identity mark). No other file needs to change.

## Run it locally
No build step — just serve the folder:
```bash
python3 -m http.server 8000
# then open http://localhost:8000
```
or use any static server / the VS Code "Live Server" extension.

## Push to GitHub
```bash
cd common-ground-web
git init
git add .
git commit -m "Initial commit: counselor directory site"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```
(Create the empty repo on GitHub first at github.com/new, without a README, then run the
commands above from inside this project folder.)

## Deploy on Netlify
1. Go to [app.netlify.com](https://app.netlify.com) and log in (GitHub login works well here).
2. **Add new site → Import an existing project → Deploy with GitHub**, then pick this repository.
3. Build settings: leave **Build command** blank and set **Publish directory** to `.`
   (already set in `netlify.toml`, so Netlify should pick it up automatically).
4. Click **Deploy site**. Netlify gives you a live `*.netlify.app` URL within a minute or two.
5. Every push to `main` on GitHub will now auto-redeploy the site.

### Personal booking links
Run `supabase/add-booking-link.sql` in Supabase SQL Editor, then reload the dashboard.
Members can add their own HTTPS booking-page URL (Cal.com or another provider) in
**Personal booking link**. The public **Book a session** button opens it in a new tab.
With no valid link, the button is disabled and explains that online booking is unavailable.
Clearing and saving the field disables booking again. The site no longer collects
session requests through a Netlify form. Previous submissions are not deleted.

### Custom domain

Use `common-ground.space` as the production domain. Configure its DNS and Netlify
custom domain before launch. In Supabase Authentication URL settings, set the Site
URL to `https://common-ground.space` and allow `https://common-ground.space/auth.html`
for invite and password-reset redirects. These hosting settings are managed outside
this repository.

Once deployed, you can add a custom domain under **Site settings → Domain management** on
Netlify and follow their DNS instructions.

## Notes
- Counselor "photos" are small procedurally generated marks (no stock imagery), so the whole
  site is copyright-clean and works without any image assets.
- Fonts (Fraunces / Inter / IBM Plex Mono) load from Google Fonts via `<link>` tags in
  `index.html` — no local font files needed.

## Shared Blog

Run `supabase/journal.sql` in the Supabase SQL Editor before enabling journal editing. This adds posts, protected editor roles, a cover-image bucket, and the Substack profile field. Nico's existing account (`nicolomantini@gmail.com`) is assigned the collective editor role; other existing members can manage their own posts. No accounts or passwords are created. Apply `supabase/limit-profile-description.sql` separately if not already applied.

- Public journal: `blog.html`; legacy Journal URLs redirect here.
- Member editor: `blog-editor.html`, linked from the dashboard.
- The visual editor supports basic formatting and poetry line breaks, limited to 30,000 stored characters. Plain-text posts remain readable. If the original setup was already run, apply `supabase/blog-formatting.sql` to enable formatted posts.
- Covers: JPEG, PNG, WebP up to 5 MB in Supabase Storage. Cover URLs are public even for drafts; removing a cover only removes its association with the post.
- Videos: public or unlisted YouTube links. The external player loads only after a visitor chooses Play.
- Save as draft unpublishes an existing post; Publish/Update makes it public immediately. No permanent-delete UI.
- New posts link to their practitioner's profile. Original static articles remain reachable at their existing `post.html?slug=…` links.
- Per-post social previews and automatic post sitemap generation are not part of this first version.

Checks: `node tests/journal.test.cjs`, plus mobile and desktop editor checks. Database row-level policies must be verified against the deployed Supabase project after applying the migration (owner, another member, editor, anonymous visitor).

The blog uses Quill 2.0.3 (BSD-3-Clause), vendored under `vendor/quill`, with its Snow icon toolbar and history module. Shift+Enter inserts a soft line break within a paragraph. Saved and pasted HTML passes through the shared formatting allowlist.
