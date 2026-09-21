# Bosa

TIDA deal scraper. See [`CLAUDE.md`](./CLAUDE.md) for full context on what
this does and what's still undecided.

## Setup

```bash
cd bosa
npm install
```

`.env` already exists (gitignored) with `GMAIL_WATCH_ADDRESS` filled in.
Follow "Gmail OAuth setup" below to fill in the three `GMAIL_*` secrets,
then:

```bash
npm start
```

## Gmail OAuth setup

Bosa uses the Gmail API, which requires an OAuth2 client — not the account
password. One-time setup, done once as `miles.templeman49@gmail.com`:

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or
   pick) a project, then enable the **Gmail API**
   (APIs & Services → Library → search "Gmail API" → Enable).
2. Configure the OAuth consent screen (APIs & Services → OAuth consent
   screen). "External" + "Testing" mode is fine for a single inbox — add
   `miles.templeman49@gmail.com` as a test user.
3. Create credentials (APIs & Services → Credentials → Create Credentials →
   OAuth client ID) of type **Desktop app**. Copy the generated Client ID
   and Client Secret into `.env` as `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`.
4. Run the helper script to get a refresh token — this opens a Google
   consent screen in your browser and writes the result straight into
   `.env`:
   ```bash
   node scripts/get-gmail-refresh-token.js
   ```
   Sign in as `miles.templeman49@gmail.com` and approve access when
   prompted.

After that, `.env` has all three `GMAIL_*` values and `npm start` can
authenticate. If you ever revoke access or rotate the client secret, just
re-run step 4.

## Layout

- `src/gmail/watcher.js` — watches the Gmail inbox for deal emails.
- `src/scraper/` — dispatches to a per-source-website scraper
  (`src/scraper/sites/`, copy `_template.js` to add a new source).
- `src/standardize/schema.js` — maps raw scraped data to TAPP's standard
  deal shape.
- `src/tapp/client.js` — loads a standardized deal into TAPP.
- `src/index.js` — wires the pipeline together.

Everything is currently a stub — see the "Open items" section in
`CLAUDE.md` for what needs to be defined before this runs end-to-end.
