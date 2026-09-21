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
  and scrape deals. First one live: CapitalRise (below). More to follow.

## Sources

### CapitalRise (`src/scraper/sites/capitalrise.js`) — first source, in progress

- **Login**: `https://www.capitalrise.com/login`, credentials in
  `SOURCE_CAPITALRISE_EMAIL` / `SOURCE_CAPITALRISE_PASSWORD`.
- **Deal email pattern**: sender is `@capitalrise.com` (e.g.
  `charlotte.macewan@capitalrise.com` — staff address varies, domain is
  what `identifySource()` in `scraper/index.js` matches on). Subject:
  `NEW INVESTMENT OPPORTUNITY - <Deal Name> Investment Launch`.
- **Deal page URL**: embedded in the email's HTML body as
  `https://www.capitalrise.com/property-investment/<Deal-Name-Slug>`
  (surrounded by click-tracking redirect links — `extractDealUrl()`
  regex-matches the direct `capitalrise.com` one).
- **Fields available in the email's "INVESTMENT HIGHLIGHTS" table** (and
  presumably also on the deal page itself): Forecast Net Return, Estimated
  Term, Anticipated LTV at Exit, IFISA Eligible, Legal Charge, Loan Type.
  No loan amount is in the email — TBD whether it's on the full deal page.
- **⚠️ Unverified**: this sandbox's network egress is blocked to
  `capitalrise.com` (org policy), so the login form selectors and
  highlight-table scraping in `capitalrise.js` were written from the
  email's content and typical site patterns, but never run against the
  real pages. Whoever runs Bosa somewhere with real internet access needs
  to verify/fix the selectors in `login()` and `readLabelledValue()`.
- Useful debug tool: `node scripts/gmail-search.js "<gmail query>"` — reads
  the watched inbox directly (already-working Gmail API) and prints
  sender/subject/body/links for any message. Used to work out the above
  from a real Bourne End deal email. Reuse it for onboarding future firms.

## Open items (not yet defined)

- More source websites beyond CapitalRise, and their login credentials.
- **Bosa currently runs in a sandboxed Claude Code container with no
  outbound network access to source sites** — actual scraping needs to run
  somewhere with normal internet access (the user's machine, a VPS, a
  cloud job). Not yet decided where.
- Exact scraped fields and the standardized deal schema TAPP expects
  (`extra` in `StandardDeal` currently holds anything that doesn't fit the
  guessed core fields, so nothing scraped is lost in the meantime).
- Whether CapitalRise's loan amount is obtainable, and from where.
- How Bosa authenticates/connects to TAPP (API endpoint, auth, data format).
- Error handling / retry behavior if a scrape or login fails.
- How multiple deals in flight at once should be handled (concurrency, dedup).
- How `watchForDealEmails()` actually detects "new" emails (polling
  interval, Gmail label/read-state, dedup across restarts) — currently a
  stub that yields nothing.

## Stack & layout

Bosa is a Node.js project living entirely under `bosa/` in the
`tida-website` repo (not a separate repo). Stack: Playwright for
site login/scraping, `googleapis` for Gmail. See `bosa/README.md` for
setup and the file layout — every module is currently a stub with a
`TODO`/thrown error marking what depends on an open item below.

## Working conventions

- Keep this file up to date as decisions are made on the open items above —
  it's the reference for anyone (or any Claude session) picking up work on
  Bosa.
- Treat scraping credentials and the Gmail credentials as secrets: never
  commit them to this repo. Use environment variables / a secrets manager,
  and document *where* they're configured here without including the values.
