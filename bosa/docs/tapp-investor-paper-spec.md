# TAPP Investor Paper — ingestion spec

This is the contract Bosa (this repo) will POST to TAPP for each scraped
deal. **TAPP doesn't have a matching endpoint yet — this document is the
spec to build it against**, not documentation of something that exists.
Whoever builds the TAPP side should treat this as the source of truth for
the payload shape; Bosa's `standardize/capitalrise.js` (and one such module
per source firm going forward) is what produces it.

Derived from screenshots of TAPP's own "Edit Investor Paper" admin form and
its mobile preview — the fields below are exactly what that form collects,
just delivered as a JSON payload instead of manual UI entry.

## Payload shape

```ts
type InvestorPaper = {
  name: string;                 // e.g. "Bourne End, Buckinghamshire"
  summary: string;              // short prose description
  irr: number | null;           // percent, e.g. 10.2
  ltv: number | null;           // percent, e.g. 75
  ltc: number | null;           // percent — see "Open questions" below
  type: string | null;          // e.g. "1st charge", "2nd charge", "Mezzanine"
  sector: string | null;        // e.g. "Residential", "Commercial"
  termMonths: number | null;    // e.g. 12
  location: "London" | "Outside London";
  city: string;                 // e.g. "Bourne End, Buckinghamshire"
  heroImages: string[];         // image URLs
  keyRisks: {
    title: string;              // e.g. "Capital and Income Risk"
    description: string;        // e.g. "Your capital is at risk and the income is not guaranteed."
    mitigation: string;         // CapitalRise's "how this applies to you" text
    severity: "Low" | "Medium" | "High";
  }[];
};
```

## Example payload (real deal: CapitalRise, Bourne End)

```json
{
  "name": "Bourne End, Buckinghamshire",
  "summary": "CapitalRise is providing a bridge loan to the Borrower to refinance the existing debt secured on a development of six houses in Bourne End, Buckinghamshire (the Properties) and provide a sales bridge period. CapitalRise investors will fund the loan alongside an institutional funding partner.",
  "irr": 10.2,
  "ltv": 75,
  "ltc": null,
  "type": "1st charge",
  "sector": "Residential",
  "termMonths": 12,
  "location": "Outside London",
  "city": "Bourne End, Buckinghamshire",
  "heroImages": [],
  "keyRisks": [
    {
      "title": "Capital and Income Risk",
      "description": "Your capital is at risk and the income is not guaranteed.",
      "mitigation": "CapitalRise will typically take a first or second legal charge over the Properties on your behalf...",
      "severity": "Medium"
    }
  ]
}
```

(This is generated and tested by `standardize/capitalrise.js` — see
`bosa/CLAUDE.md` "Sources > CapitalRise" for how it's verified against real
deal content.)

## Suggested delivery (placeholder — needs a decision on the TAPP side)

Not yet confirmed — proposing as a starting point:

- `POST /api/investor-papers` with the JSON body above, `Content-Type: application/json`.
- Auth: TBD (API key header? Same auth TAPP's own admin API uses?).
- Response: TBD — at minimum Bosa needs back either a success/failure
  status, or the created record's ID for logging/dedup purposes.
- Hero images: sent as plain URLs here, on the assumption TAPP can fetch
  and store them itself. If TAPP instead needs the image *bytes* uploaded
  (e.g. multipart), that's a different, larger integration than a single
  JSON POST — needs deciding before this is built.

## Open questions (fields with no confirmed source yet)

These are guessed/defaulted in `standardize/capitalrise.js` today, flagged
with `TODO` comments there. Whoever builds the TAPP endpoint should know
these aren't reliable yet:

- **`ltc`** — always `null`. Not present in any CapitalRise content
  gathered so far (the deal page's "day one LTV" is a different, 68%
  figure that doesn't match the 65.0% shown in the TAPP form example).
  Unclear if CapitalRise exposes LTC anywhere, or if it needs a different
  source (manual entry? computed from loan amount and full project cost,
  if that's ever available?).
- **`location`** — heuristic only (checks if the city name contains
  "London"), so a Greater London deal that doesn't literally say "London"
  (e.g. "Chelsea") would be misclassified as "Outside London".
- **`keyRisks[].severity`** — CapitalRise's risk table has no severity
  rating; every risk is hardcoded to `"Medium"`.
- **`heroImages`** — the scraper's selector for finding these on the deal
  page is an unverified guess (no real page markup available to check it
  against yet), separate from the LTC/location/severity issue of having no
  data source at all.

## Also still open (see `bosa/CLAUDE.md` for the full list)

- Bosa currently runs in a sandbox with no network access to CapitalRise
  or (once it exists) TAPP's API — needs a real-network environment to
  actually run and be tested end-to-end.
- This spec only covers CapitalRise. Each new source firm gets its own
  `standardize/<source>.js` mapping into this same `InvestorPaper` shape.
