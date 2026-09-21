// Finds deal-notification emails from known source firms that haven't been
// processed yet. Designed to be run once per invocation (e.g. from a daily
// cron job at 5pm — see README.md "Running on a schedule"), not as a
// long-running watch loop: each run queries for anything not yet labeled
// "processed", yields it, and the caller (src/index.js) marks it done via
// markDealEmailProcessed() once it's successfully made it all the way to
// TAPP. That label is what makes tomorrow's run skip it.

import { getGmailClient, extractHeaders, extractPlainBody, extractHtmlBody } from "./client.js";
import { knownSources } from "../scraper/index.js";

const PROCESSED_LABEL = "Bosa/Processed";

let cachedLabelId;

/**
 * @returns {Promise<AsyncIterable<{ id: string, from: string, subject: string, body: string, htmlBody: string }>>}
 */
export async function watchForDealEmails() {
  const gmail = getGmailClient();
  await gmail.users.getProfile({ userId: "me" }); // fail fast on bad credentials

  if (knownSources.length === 0) {
    throw new Error("No known sources registered in scraper/index.js");
  }

  const perSourceClauses = knownSources.map(({ fromDomain, gmailSubjectFilter }) =>
    gmailSubjectFilter ? `(from:${fromDomain} ${gmailSubjectFilter})` : `from:${fromDomain}`
  );
  const query = `(${perSourceClauses.join(" OR ")}) -label:"${PROCESSED_LABEL}"`;

  const { data: list } = await gmail.users.messages.list({ userId: "me", q: query });
  const messages = list.messages ?? [];

  return (async function* () {
    for (const { id } of messages) {
      const { data: msg } = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      const headers = extractHeaders(msg.payload);
      yield {
        id,
        from: headers.from,
        subject: headers.subject,
        body: extractPlainBody(msg.payload),
        htmlBody: extractHtmlBody(msg.payload),
      };
    }
  })();
}

/**
 * Marks a deal email as handled so future runs skip it. Call this only
 * after the deal has been successfully loaded into TAPP — leaving a
 * failed one unlabeled means tomorrow's run retries it.
 * @param {string} messageId
 */
export async function markDealEmailProcessed(messageId) {
  const gmail = getGmailClient();
  const labelId = await getOrCreateProcessedLabelId(gmail);
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds: [labelId] },
  });
}

async function getOrCreateProcessedLabelId(gmail) {
  if (cachedLabelId) return cachedLabelId;

  const { data } = await gmail.users.labels.list({ userId: "me" });
  const existing = data.labels?.find((l) => l.name === PROCESSED_LABEL);
  if (existing) {
    cachedLabelId = existing.id;
    return cachedLabelId;
  }

  const { data: created } = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: PROCESSED_LABEL,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });
  cachedLabelId = created.id;
  return cachedLabelId;
}
