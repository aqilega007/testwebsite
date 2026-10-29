# UNH AI Club website

Static site in `public/` plus one Netlify Function (`netlify/functions/api.mjs`) that
stores content and checks the officer login. No other services.

## Officer guide (no code)
1. Open the site, click **Officer login** (bottom-right corner), enter the club email and password.
2. Use the buttons on each page: add / edit / delete events, schedule rows, officers,
   articles; change the meeting flyer and GroupMe QR; edit the About text.
3. Photos are shrunk in your browser before upload. Any phone photo works.
4. **Download backup** (bottom bar) saves all text content as a file. Do this monthly.
   Photos stay in storage; the backup keeps links to them.
5. **Log out** when done on a shared computer.

## Admin setup (once)
1. Run `node scripts/make-password-hash.mjs`, choose a password, copy the two values it prints.
2. In Netlify: Project configuration > Environment variables, add:
   `ADMIN_EMAIL` (club email), `ADMIN_HASH`, `SESSION_SECRET`.
3. Redeploy. To change the password: repeat step 1 and update `ADMIN_HASH`.

## Not editable from the admin page (edit the HTML)
Hero and tile photos, the Projects page, the Ethics list, the footer links (`SOCIAL` in
`public/app.js`), and the nav (`NAV` in `public/app.js`).

## Local testing
`npx netlify dev` (needs Node). Without the API the pages show `public/content.seed.json`.
