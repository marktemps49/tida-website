// Watches the configured Gmail inbox for new deal-notification emails and
// hands each one to the pipeline.

import { google } from "googleapis";

function getGmailClient() {
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

/**
 * Polls Gmail for new deal-notification emails.
 *
 * TODO: define how a "deal email" is identified (sender, subject pattern,
 * a label, etc.) — see bosa/CLAUDE.md open items. Currently a placeholder
 * that yields nothing.
 *
 * @returns {Promise<AsyncIterable<{ id: string, from: string, subject: string, body: string }>>}
 */
export async function watchForDealEmails() {
  const gmail = getGmailClient();
  // Sanity-check credentials so failures surface immediately, not on the
  // first (not-yet-implemented) poll.
  await gmail.users.getProfile({ userId: "me" });

  return (async function* () {
    // TODO: implement polling (or a push/watch subscription) once deal
    // emails are identifiable, then yield each new one.
  })();
}
