// Watches the configured Gmail inbox for new deal-notification emails and
// hands each one to the pipeline. TODO: implement once Gmail access is
// provided (see bosa/CLAUDE.md open items).

/**
 * @returns {Promise<AsyncIterable<{ id: string, from: string, subject: string, body: string }>>}
 */
export async function watchForDealEmails() {
  throw new Error("watchForDealEmails: not yet implemented (needs Gmail credentials)");
}
