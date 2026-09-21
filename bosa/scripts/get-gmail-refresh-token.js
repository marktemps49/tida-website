// One-time setup helper: exchanges a Google OAuth consent for a long-lived
// refresh token, and writes it into .env.
//
// This runs in a remote container, so the loopback-server flow (browser and
// script on the same machine) doesn't work here. Instead:
//
//   1. Run:  node scripts/get-gmail-refresh-token.js
//      It prints a Google consent URL.
//   2. Open that URL in your own browser, sign in as
//      miles.templeman49@gmail.com, and approve access.
//   3. Google redirects to http://localhost:53682/oauth2callback?code=...
//      — your browser will show "can't be reached", that's expected
//      (nothing is listening on your machine). Copy the "code" value out
//      of the address bar.
//   4. Run:  node scripts/get-gmail-refresh-token.js "<code>"
//      This exchanges it for a refresh token and writes it into .env.

import "dotenv/config";
import fs from "node:fs";
import { google } from "googleapis";

const REDIRECT_URI = "http://localhost:53682/oauth2callback";
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET (in .env or the environment) first."
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const code = process.argv[2];

if (!code) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token even on repeat runs
    scope: SCOPES,
  });

  console.log("\n1. Open this URL in your own browser and sign in as miles.templeman49@gmail.com:\n");
  console.log(authUrl);
  console.log(
    "\n2. Approve access. You'll land on a 'can't be reached' page at " +
      `${REDIRECT_URI}?code=...&scope=... — that's expected.`
  );
  console.log(
    '3. Copy the value of the "code" parameter from that URL, then run:\n' +
      '   node scripts/get-gmail-refresh-token.js "<code>"\n'
  );
  process.exit(0);
}

try {
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "No refresh_token in the response. This usually means access was already " +
        "granted before without revoking it — go to https://myaccount.google.com/permissions, " +
        "remove access for this app, then re-run step 1 to get a fresh code."
    );
    process.exit(1);
  }
  upsertEnvVar(".env", "GMAIL_REFRESH_TOKEN", tokens.refresh_token);
  console.log("Success — GMAIL_REFRESH_TOKEN written to .env.");
} catch (err) {
  console.error("Token exchange failed:", err.message ?? err);
  console.error(
    "Codes are single-use and expire quickly — if this is a re-run, get a fresh code from step 1."
  );
  process.exit(1);
}

function upsertEnvVar(path, key, value) {
  const content = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.trimEnd()}\n${line}\n`;
  fs.writeFileSync(path, next);
}
