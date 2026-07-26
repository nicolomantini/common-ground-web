# Grove Counseling — counselor directory site

A simple, static, responsive site where visitors can browse counselors, filter by
specialty / format / language, and request a session. No backend or build step required —
plain HTML, CSS, and JS.

## Project structure
```
index.html          Page markup (hero, filters, directory, booking form)
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
cd counselor-site
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

### The booking form
The "Request a session" form uses **Netlify Forms** — no backend needed. Once deployed on
Netlify, submissions automatically show up under your site's **Forms** tab in the Netlify
dashboard, and you can turn on email notifications there (Site settings → Forms → Form
notifications). Locally, or on non-Netlify hosts, the form will submit as a normal POST and
show a plain confirmation page — that's expected; it will only work end-to-end once deployed
on Netlify.

### Custom domain
Once deployed, you can add a custom domain under **Site settings → Domain management** on
Netlify and follow their DNS instructions.

## Notes
- Counselor "photos" are small procedurally generated marks (no stock imagery), so the whole
  site is copyright-clean and works without any image assets.
- Fonts (Fraunces / Inter / IBM Plex Mono) load from Google Fonts via `<link>` tags in
  `index.html` — no local font files needed.
