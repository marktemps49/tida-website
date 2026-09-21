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

The scope requested is `gmail.modify` (not just `gmail.readonly`) — Bosa
needs it to label an email "Bosa/Processed" once it's loaded into TAPP, so
the next run doesn't process it again. If your refresh token was generated
before this changed, re-run step 4 to get a new one with the right scope.

## CapitalRise session setup

CapitalRise's login is behind reCAPTCHA, which blocks Bosa's automated
form login outright (confirmed against the live site — see CLAUDE.md). A
human logs in once by hand instead, and Bosa reuses that session:

```bash
cd bosa
node scripts/capitalrise-save-session.js
```

This **must run on a machine with a real display** (not this dev sandbox,
not GitHub Actions) — it opens a visible browser window for you to log
into CapitalRise normally, including solving the CAPTCHA yourself. Once
done, it saves `capitalrise-session.json` and prints instructions for
pasting its contents into the `SOURCE_CAPITALRISE_SESSION_STATE` secret
(`.env` locally, or the GitHub Actions secret for the scheduled workflow).

Sessions eventually expire (how often isn't known yet). When that happens,
Bosa throws a clear error naming the problem rather than silently
scraping nothing — just re-run the script above and update the secret.

## Running on a schedule

Bosa is a one-shot script, not a long-running process: each run checks
Gmail for deal emails not yet labeled `Bosa/Processed`, processes whatever
it finds (this includes any historical backlog on the very first run —
nothing is skipped just for being old), and exits.

**Decided**: runs via GitHub Actions rather than a self-managed VPS —
`.github/workflows/bosa-daily.yml` (repo root) schedules it once a day at
5pm UK time (handling the BST/GMT switch automatically — see the comment
in that file) and pulls all secrets from the repo's GitHub Actions
secrets, not `.env` (which stays local-only, used for `npm start` when
testing by hand).

**⏸️ Currently paused**: the daily schedule is commented out in
`bosa-daily.yml` at the user's request, while CapitalRise (and future
sources) are still being verified. It only runs when manually triggered
(Actions tab → "Run workflow", or via the API/MCP) until the user says to
turn the automatic daily run back on — just un-comment the two `cron:`
lines under `schedule:` in that file.

## Layout

- `src/gmail/client.js` — shared Gmail API client + message parsing, used
  by both the watcher and `scripts/gmail-search.js`.
- `src/gmail/watcher.js` — finds unprocessed deal emails from known source
  firms, and marks one processed once it's fully loaded into TAPP.
- `src/scraper/` — dispatches to a per-source-website scraper
  (`src/scraper/sites/`, copy `_template.js` to add a new source).
- `src/standardize/` — maps each source's raw scraped data to TAPP's
  Investor Paper JSON shape (`docs/tapp-investor-paper-spec.md`).
- `src/tapp/client.js` — loads a standardized deal into TAPP (TAPP itself
  has no ingestion endpoint yet — see the spec doc).
- `src/index.js` — wires the pipeline together.
- `tools/deal-preview.html` — standalone dev tool, open directly in a
  browser (no server needed). Paste a deal JSON (`InvestorPaper` shape) to
  preview it roughly as TAPP would show it, for checking scraper/
  standardizer output before TAPP's real ingestion endpoint exists.

See the "Open items" section in `CLAUDE.md` for what's still undefined —
notably, this needs to run somewhere with real internet access; it can't
reach source sites from this dev sandbox.
