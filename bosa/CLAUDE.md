# Bosa — TIDA Deal Scraper

This folder is a separate tool inside the `tida-website` repo. It is not part of
the public marketing site (`index.html` / `styles.css` at the repo root) — keep
Bosa's code, config, and dependencies self-contained under `bosa/`.

## What Bosa does

Bosa sources property debt deals from multiple external websites, standardizes
the data into a common format, and loads it into TAPP (see below).

## Trigger

**Decided**: a daily cron job at 5pm runs Bosa once (`npm start` — see
README.md "Running on a schedule"). It's a one-shot script, not a
long-running watcher: each run queries Gmail for deal emails not yet
labeled `Bosa/Processed` (via `src/gmail/watcher.js`), processes each one,
and exits. A deal only gets the label after it's *successfully* made it
all the way into TAPP — a failed run leaves it unlabeled so the next day's
run retries it.

**Decided**: the very first run processes the full historical backlog of
unprocessed deal emails (nothing is skipped just for being old) — verified
in a real (if network-blocked) run against the actual inbox, which found
14 past "NEW INVESTMENT OPPORTUNITY" emails from CapitalRise, none
previously labeled.

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
  `tida-website`. Bosa POSTs a JSON payload to it (not UI automation) — the
  payload shape is finalized as a spec for TAPP to build an endpoint
  against; see `docs/tapp-investor-paper-spec.md`. TAPP has **no such
  endpoint yet** — this is a spec to hand to whoever builds it, not
  documentation of something live.
- **Source websites** — the multiple external sites Bosa logs into to find
  and scrape deals. First one live: CapitalRise (below). More to follow.

## Sources

### CapitalRise (`src/scraper/sites/capitalrise.js`) — first source, in progress

- **Login is reCAPTCHA-blocked — confirmed by a real run.** Automated form
  login (`page.fill()` + submit) silently fails: the form just re-displays
  with no error and no URL change, because the login page shows "This site
  is protected by reCAPTCHA." This project does not attempt to defeat that
  (CAPTCHA-solving services, browser fingerprint spoofing, etc.) — it would
  mean circumventing an anti-bot measure CapitalRise deliberately built in.
  **Fix in place**: a human logs into CapitalRise by hand once (solving the
  CAPTCHA themselves) via `scripts/capitalrise-save-session.js`, run on a
  machine with a real display (not this sandbox, not GitHub Actions — both
  are headless). That script saves the authenticated session (cookies +
  local storage) to a file; its contents go into the
  `SOURCE_CAPITALRISE_SESSION_STATE` secret, which `capitalrise.js` loads
  via Playwright's `storageState` instead of logging in itself. See
  `bosa/README.md` "CapitalRise session setup". Sessions eventually expire
  (unknown how often) — `capitalrise.js` detects this (deal page shows the
  logged-out teaser text) and throws a clear error naming the fix, rather
  than silently scraping nothing like it did before this was diagnosed.
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
  vs. exit), and a two-column Risks table (risk title/description, then
  "how this applies to you"). Full detail in the fixture file.
- **Extraction is implemented and tested against the fixture** (not the
  live site — see the ⚠️ below):
  - `extractSections()` / `extractHighlights()` in `capitalrise.js` parse
    the page's plain text (`page.innerText("body")`) for the Investment
    Summary prose and the Investment Highlights table. Chosen over
    per-field CSS selectors because innerText survives markup/class
    changes better; verified against the fixture to produce exactly the
    PLAN/TERM/LOCATION/PROPERTY/THE SECURITY text and all 7 highlight
    values.
  - `extractRisks()` / `extractHeroImages()` still use DOM selectors
    (`table tr` for risks, `[class*="gallery|carousel"] img` for images)
    since that structure can't be inferred from pasted plain text — these
    are guesses, unverified.
  - `standardize/capitalrise.js`'s `standardizeCapitalRiseDeal()` maps the
    scraped raw shape to TAPP's **Investor Paper JSON** (confirmed from
    screenshots of TAPP's admin "Edit Investor Paper" form + its mobile
    preview — the target is a JSON payload for a direct API call, *not*
    driving that UI form):
    ```
    { name, summary, irr, ltv, ltc, type, sector, termMonths,
      location: "London" | "Outside London", city, heroImages,
      keyRisks: [{ title, description, mitigation, severity }] }
    ```
    Tested against the real Bourne End content end-to-end — produces
    `name`/`city` = "Bourne End, Buckinghamshire", `irr` = 10.2, `ltv` = 75,
    `type` = "1st charge", `sector` = "Residential", `termMonths` = 12,
    all matching the TAPP form screenshot. Full spec + example payload:
    `docs/tapp-investor-paper-spec.md`.
  - **Fields with no confirmed source, currently guessed/defaulted** — flagged
    with TODO comments in `standardize/capitalrise.js`, need the user's input:
    - `ltc` (loan-to-cost): not in the email or deal page content gathered
      so far. The page's "day one LTV" (68% for Bourne End) is a different
      metric and doesn't match the 65.0 shown in the TAPP form example —
      unclear if LTC is calculable from CapitalRise's data at all, or
      needs a different source/manual entry.
    - `location` ("London" vs "Outside London"): heuristic only — checks
      whether "London" appears in the city name. Wrong for a Greater
      London deal that doesn't literally say "London" (CapitalRise covers
      "London and the Home Counties").
    - `keyRisks[].severity`: CapitalRise's risk table has no severity
      rating at all — every risk currently defaults to "Medium".
    - `heroImages`: selector is a guess (see above) — untested even at the
      parsing-logic level, unlike sections/highlights/risks.
- **Runs on GitHub Actions, which has real internet access** — this dev
  sandbox is network-blocked to `capitalrise.com`, but Bosa doesn't run
  here; it runs via `.github/workflows/bosa-daily.yml` on GitHub's
  runners, confirmed to reach the real site fine (uses
  `PLAYWRIGHT_CHROMIUM_PATH` only in this sandbox for local dev testing —
  GitHub Actions runs `npx playwright install` itself so doesn't need it).
- **⚠️ Extraction against the real *logged-in* page is still unverified.**
  Every real run so far has actually hit the reCAPTCHA login wall above
  and scraped the *logged-out* teaser page by mistake (different content
  entirely — e.g. its Investment Summary section is headed "OVERVIEW", not
  "PLAN" like the real page the user pasted). Once a
  `SOURCE_CAPITALRISE_SESSION_STATE` is set up (see above),
  `extractSections()`/`extractHighlights()` need re-testing against what
  the actual logged-in page produces — they're currently only verified
  against the fixture file (`src/scraper/sites/__fixtures__/capitalrise-bourne-end.txt`,
  pasted by the user), which may or may not exactly match the live DOM's
  `page.innerText()` output. `extractRisks()`/`extractHeroImages()` (DOM
  selectors, not text-based) are unverified guesses regardless.
- Useful debug tools:
  - `node scripts/gmail-search.js "<gmail query>"` — reads the watched
    inbox directly and prints sender/subject/body/links for any message.
    Used to work out the deal email pattern from a real Bourne End email.
  - `BOSA_DEBUG_DUMP_PAGE_TEXT=1` env var (or the `debug_dump_page_text`
    workflow_dispatch input) — logs the deal page's raw
    `page.innerText("body")`. This is what revealed the reCAPTCHA/logged-out
    issue above; reuse it to verify extraction once really logged in.
  - `BOSA_MAX_DEALS=<n>` env var (or the `max_deals` workflow_dispatch
    input) — caps how many deals a run processes, for controlled testing
    against a real backlog instead of all of it at once.

## Open items (not yet defined)

- More source websites beyond CapitalRise, and their login credentials.
- **Re-verify CapitalRise extraction against the real logged-in page**
  once `SOURCE_CAPITALRISE_SESSION_STATE` is set up — see ⚠️ above. This
  is now the actual next step, not network access (resolved — see above).
- How often CapitalRise's saved session expires, and whether that can be
  automated at all (vs. always needing a human to re-run
  `capitalrise-save-session.js`).
- The four CapitalRise fields with no confirmed source, listed above
  (`ltc`, `location` heuristic, risk `severity`, `heroImages` selector).
- How Bosa authenticates/connects to TAPP: the JSON payload shape is
  finalized as the spec (`docs/tapp-investor-paper-spec.md`) for TAPP's
  side to build an endpoint against — **decided this is the direction**,
  not still open. What's still unknown: the endpoint doesn't exist yet, so
  its URL, auth mechanism, response shape, and whether hero images need a
  separate upload call (vs. sending plain URLs) are all TBD until it's
  built.
- Error handling / retry behavior if a scrape or login fails beyond "leave
  it unlabeled, retry tomorrow" (e.g. alerting, a max-retry cutoff for a
  deal that keeps failing).
- How multiple deals in flight at once should be handled (concurrency —
  currently strictly sequential, one deal at a time, in `src/index.js`).
- The Gmail refresh token currently in `.env` was generated with
  `gmail.readonly` scope, before the "Bosa/Processed" labeling design was
  decided — labeling requires `gmail.modify`. **Needs re-running
  `scripts/get-gmail-refresh-token.js`'s OAuth flow** (now updated to
  request `gmail.modify`) to get a token that can actually apply the
  label; untested until then.

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
