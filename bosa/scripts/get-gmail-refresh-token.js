// One-time setup helper: exchanges a Google OAuth consent for a long-lived
// refresh token, and writes it into .env. Run this once after creating the
// OAuth client (see README.md "Gmail OAuth setup").
//
// Usage:
//   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/get-gmail-refresh-token.js
// (or fill GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET into .env first, then just
//  `node scripts/get-gmail-refresh-token.js`)
//
// Must be run on a machine with a browser, since it opens a localhost
// callback for Google to redirect back to after you approve access.

import "dotenv/config";
import fs from "node:fs";
import http from "node:http";
import { google } from "googleapis";

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
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

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // forces a refresh_token even on repeat runs
  scope: SCOPES,
});

console.log("\n1. Open this URL and sign in as miles.templeman49@gmail.com:\n");
console.log(authUrl);
console.log("\n2. Approve access. You'll be redirected to localhost — this script handles that.\n");

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/oauth2callback")) {
    res.writeHead(404);
    res.end();
    return;
  }

  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Success — you can close this tab and return to the terminal.");
    server.close();

    console.log("\nRefresh token obtained. Writing it into .env ...");
    upsertEnvVar(".env", "GMAIL_REFRESH_TOKEN", tokens.refresh_token);
    console.log("Done — GMAIL_REFRESH_TOKEN set in .env.");
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Failed to exchange code for tokens — see the terminal.");
    console.error("Token exchange failed:", err);
    server.close();
  }
});

server.listen(PORT, () => {
  console.log(`Waiting for the OAuth redirect on ${REDIRECT_URI} ...`);
});

function upsertEnvVar(path, key, value) {
  const content = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.trimEnd()}\n${line}\n`;
  fs.writeFileSync(path, next);
}
