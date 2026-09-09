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
you run Node processes. Recommended: **Render** (simplest, free tier
available) or **Railway** (similar tradeoffs). Both spin down an idle free
instance, giving a ~30-60s cold start on the first request after a quiet
period; upgrade to a paid tier to keep it warm once that matters.

A serverless platform (Vercel/Netlify/Cloudflare Functions) is a worse fit
for this specific workload — deal extraction can take 30-90+ seconds and
uploads can run tens of MB, both of which fight the free-tier timeout and
body-size limits on those platforms. Stick to a long-running server unless
you're prepared to configure around that.

### Render

There's a best-effort `render.yaml` Blueprint at the repo root — try
**New > Blueprint**, point it at this repo, and see if it picks it up. If
it doesn't parse cleanly (unverified against Render's current schema),
fall back to the manual path, which doesn't depend on the YAML being
right:

1. **New > Web Service**, connect this GitHub repo.
2. **Root Directory**: `server`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Environment** tab → add `ANTHROPIC_API_KEY` (your key, marked secret)
   and optionally `ANTHROPIC_MODEL` / `CORS_ORIGIN`. Leave `PORT` alone —
   Render sets it automatically and `server.js` already reads it.
6. Deploy, then confirm with `curl https://<your-service>.onrender.com/api/health`.

### Railway

1. **New Project > Deploy from GitHub repo**, pick this repo.
2. In the service's **Settings**, set **Root Directory** to `server`.
3. Railway auto-detects `npm install` / `npm start` from `package.json` —
   confirm those are the build/start commands.
4. **Variables** tab → add `ANTHROPIC_API_KEY` (and optionally
   `ANTHROPIC_MODEL` / `CORS_ORIGIN`). Railway sets `PORT` automatically too.
5. Deploy, then confirm with `curl https://<your-service>.up.railway.app/api/health`.

### After either one

- Set `CORS_ORIGIN` to the frontend's real origin once it's live somewhere
  other than `localhost` — don't leave it at `*` in production.
- Update `SCORING_API_URL` in `../js/upload.js` to the deployed URL (it
  currently points at `http://localhost:8787` for local dev).
