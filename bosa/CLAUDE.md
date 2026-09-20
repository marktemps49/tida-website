# Bosa — TIDA Deal Scraper

This folder is a separate tool inside the `tida-website` repo. It is not part of
the public marketing site (`index.html` / `styles.css` at the repo root) — keep
Bosa's code, config, and dependencies self-contained under `bosa/`.

## What Bosa does

Bosa sources property debt deals from multiple external websites, standardizes
the data into a common format, and loads it into TAPP (see below).

## Trigger

The pipeline is triggered automatically when a new deal email arrives in a
specific Gmail inbox (access to be provided later by the user).

## Pipeline steps

1. **Watch** the designated Gmail inbox for incoming deal emails.
2. **Identify** which source website the deal is on and what the deal is,
   from the email content.
3. **Log in** to that source website.
4. **Locate** the relevant deal on the site.
5. **Scrape** the required data fields for that deal.
6. **Standardize** the scraped data into TIDA's standard deal format.
7. **Load** the standardized deal into TAPP.

## Key terms / systems

- **Bosa** — this tool (the deal scraper described in this file).
- **TAPP** (TIDA Private Client App) — the destination system. It is a
  **separate application in a separate repository/codebase**, not part of
  `tida-website`. Bosa integrates with TAPP as an external system (exact
  integration method — API, file drop, DB write, etc. — TBD).
- **Source websites** — the multiple external sites Bosa logs into to find
  and scrape deals. Specific sites, credentials, and page structures: TBD.

## Open items (not yet defined)

- Gmail account/credentials Bosa will monitor (user will provide access).
- List of source websites and login credentials for each.
- Exact scraped fields and the standardized deal schema TAPP expects.
- How Bosa authenticates/connects to TAPP (API endpoint, auth, data format).
- Error handling / retry behavior if a scrape or login fails.
- How multiple deals in flight at once should be handled (concurrency, dedup).

## Working conventions

- Keep this file up to date as decisions are made on the open items above —
  it's the reference for anyone (or any Claude session) picking up work on
  Bosa.
- Treat scraping credentials and the Gmail credentials as secrets: never
  commit them to this repo. Use environment variables / a secrets manager,
  and document *where* they're configured here without including the values.
