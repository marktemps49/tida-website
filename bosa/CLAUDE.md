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
- **Real deal page content**: the user pasted the full Bourne End deal page
  text directly (this sandbox can't fetch it itself) — saved verbatim at
  `src/scraper/sites/__fixtures__/capitalrise-bourne-end.txt` for offline
  development/testing. The page's actual "Investment Highlights" table
  labels differ from the email's summary table — use these, not the
  email's wording, as the source of truth:
  - `Net forecast annual return` (email said "Forecast Net Return")
  - `Total loan amount` — e.g. "£13.6 million" (**not in the email at all**)
  - `Total CapitalRise investor raise` — e.g. "£3.1 million" (not in email)
  - `Estimated term`
  - `Anticipated LTV at exit`
  - `ISA` → "Eligible" (email said "IFISA Eligible")
  - `Product` — e.g. "Debt - Deep Discounted Bonds" (not in email)
  - `Security` — longer free text, not a single value
  Plus a full "Investment Summary" prose section (PLAN, TERM, LOCATION,
  PROPERTY, THE BORROWER, THE SECURITY, SECURITY TRUSTEE, VALUATION, LOAN
  TO VALUE, EXIT PLAN), a Financials section (funding structure at entry
  vs. exit), and a Risks table. Full detail in the fixture file.
  **The user is providing the target extraction format separately —
  `capitalrise.js`'s `HIGHLIGHT_LABELS`/`extractDealFields` have not been
  rewritten to match the real page yet; that's the next step once the
  format arrives.**
- **⚠️ Still unverified against the live site**: this sandbox's network
  egress is blocked to `capitalrise.com` (org policy), so even once
  `capitalrise.js` is rewritten to extract the fields above, the actual
  DOM selectors (`login()`, `readLabelledValue()`) are unverified — no
  browser has ever loaded the real page. Whoever runs Bosa somewhere with
  real internet access needs to confirm/fix them.
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
