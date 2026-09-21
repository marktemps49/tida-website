// Debug/onboarding helper: search the watched Gmail inbox and print
// matching messages' sender, subject, and body — used to work out a new
// source's email pattern (sender address, subject format) for
// scraper/index.js's identifySource().
//
// Usage:
//   node scripts/gmail-search.js "from:capitalrise.com Bourne End"

import "dotenv/config";
import { google } from "googleapis";

const query = process.argv.slice(2).join(" ");
if (!query) {
  console.error('Usage: node scripts/gmail-search.js "<gmail search query>"');
  process.exit(1);
}

const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { data: list } = await gmail.users.messages.list({
  userId: "me",
  q: query,
  maxResults: 5,
});

if (!list.messages?.length) {
  console.log("No messages matched that query.");
  process.exit(0);
}

for (const { id } of list.messages) {
  const { data: msg } = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const headers = Object.fromEntries(
    msg.payload.headers.map((h) => [h.name.toLowerCase(), h.value])
  );

  console.log("=".repeat(80));
  console.log("From:", headers.from);
  console.log("Subject:", headers.subject);
  console.log("Date:", headers.date);
  console.log("-".repeat(80));
  console.log(extractBody(msg.payload).slice(0, 3000));

  const links = extractLinks(msg.payload);
  if (links.length) {
    console.log("-".repeat(80));
    console.log("Links found in HTML body:");
    links.forEach((l) => console.log(" ", l));
  }
}

function extractBody(payload) {
  if (payload.body?.data) return decode(payload.body.data);
  const part =
    payload.parts?.find((p) => p.mimeType === "text/plain") ??
    payload.parts?.find((p) => p.mimeType === "text/html") ??
    payload.parts?.[0];
  if (!part) return "(no body found)";
  if (part.body?.data) return decode(part.body.data);
  if (part.parts) return extractBody(part);
  return "(no body found)";
}

function decode(base64url) {
  return Buffer.from(base64url, "base64url").toString("utf8");
}

function extractHtml(payload) {
  if (payload.mimeType === "text/html" && payload.body?.data) return decode(payload.body.data);
  for (const part of payload.parts ?? []) {
    const html = extractHtml(part);
    if (html) return html;
  }
  return null;
}

function extractLinks(payload) {
  const html = extractHtml(payload);
  if (!html) return [];
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  return hrefs.filter((href) => {
    if (href.startsWith("mailto:") || seen.has(href)) return false;
    seen.add(href);
    return true;
  });
}
