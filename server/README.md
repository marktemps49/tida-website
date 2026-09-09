# TIDA Methodology Server

Receives the deal documents uploaded on the website, runs them through the
TIDA Methodology Agent (Claude, instructed by `../CREDIT_METHODOLOGY.md`),
and returns the extracted scoring parameters as JSON — the same shape the
site's `js/credit-model.js` already scores against.

## Setup

```bash
cd server
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY (get one at https://console.anthropic.com/settings/keys)
npm start
```

The server listens on `http://localhost:8787` by default (`PORT` in `.env`
to change it). Check it's up and has a key configured:

```bash
curl http://localhost:8787/api/health
```

## API

### `POST /api/score-deal`

`multipart/form-data`:

| Field | Required | Notes |
|---|---|---|
| `files` | Yes, 1+ | PDF, DOCX/DOC, XLSX/XLS/CSV, TXT, PNG/JPG. 20MB per file, 15 files max. |
| `dealName` | No | Falls back to the first file's name. |
| `dealType` | No | `Development`, `Planning`, or `Transition` — the agent confirms/overrides from the documents regardless. |

Response body matches `CREDIT_METHODOLOGY.md` §6 (`dealType`, `answers`,
`extraction`, `unresolved`, `notes`), plus `dealName` and any file-level
`warnings` (e.g. an unsupported file type that had to be skipped).

Non-2xx responses are `{ error: string, ... }` — see `server.js` for the
specific cases (bad upload, Claude API error, invalid/unparseable agent
output, missing API key).

## Cost note

Defaults to `claude-opus-5` per the house default for Claude API work.
Document extraction across a full deal pack is not cheap at Opus rates —
set `ANTHROPIC_MODEL=claude-sonnet-5` in `.env` if you'd rather trade some
extraction quality for lower cost. That's a call only you can make; nothing
here downgrades it for you automatically.

## Deploying

This is a plain Express app with no framework lock-in — deploy it wherever
you run Node processes (Render, Fly.io, Railway, a VM, a container, etc.),
or adapt `server.js`'s route handler into a serverless function (Vercel/
Netlify/Cloudflare) if that's your hosting. Whatever you choose:

- Set `ANTHROPIC_API_KEY` as a server-side secret — never ship it to the browser.
- Set `CORS_ORIGIN` to the site's real origin once it's not `*` for local dev.
- Point the frontend at the deployed URL — see `SCORING_API_URL` in
  `../js/upload.js`.
