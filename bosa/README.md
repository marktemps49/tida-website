# Bosa

TIDA deal scraper. See [`CLAUDE.md`](./CLAUDE.md) for full context on what
this does and what's still undecided.

## Setup

```bash
cd bosa
npm install
cp .env.example .env   # then fill in credentials
npm start
```

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
