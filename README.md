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
