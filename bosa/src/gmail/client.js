// Shared Gmail API client + message-parsing helpers, used by both the
// production watcher (src/gmail/watcher.js) and the onboarding debug tool
// (scripts/gmail-search.js).

import { google } from "googleapis";

export function getGmailClient() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error(
      "Missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN. " +
        "See README.md 'Gmail OAuth setup'."
    );
  }

  const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/** @param {{ headers: { name: string, value: string }[] }} payload */
export function extractHeaders(payload) {
  return Object.fromEntries(payload.headers.map((h) => [h.name.toLowerCase(), h.value]));
}

export function extractPlainBody(payload) {
  if (payload.mimeType === "text/plain" && payload.body?.data) return decode(payload.body.data);
  if (payload.body?.data && !payload.parts) return decode(payload.body.data);
  const part =
    payload.parts?.find((p) => p.mimeType === "text/plain") ??
    payload.parts?.find((p) => p.mimeType === "text/html") ??
    payload.parts?.[0];
  if (!part) return "";
  if (part.body?.data) return decode(part.body.data);
  if (part.parts) return extractPlainBody(part);
  return "";
}

export function extractHtmlBody(payload) {
  if (payload.mimeType === "text/html" && payload.body?.data) return decode(payload.body.data);
  for (const part of payload.parts ?? []) {
    const html = extractHtmlBody(part);
    if (html) return html;
  }
  return "";
}

export function extractLinks(payload) {
  const html = extractHtmlBody(payload);
  if (!html) return [];
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  return hrefs.filter((href) => {
    if (href.startsWith("mailto:") || seen.has(href)) return false;
    seen.add(href);
    return true;
  });
}

function decode(base64url) {
  return Buffer.from(base64url, "base64url").toString("utf8");
}
