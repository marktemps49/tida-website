// Given a deal email, identifies its source website and dispatches to that
// site's scraper. Add one module per source under src/scraper/sites/,
// register it in scrapersBySource, and add its sender domain to
// sourcesByFromDomain as new firms are onboarded (see CLAUDE.md).

const scrapersBySource = {
  capitalrise: () => import("./sites/capitalrise.js"),
};

const sourcesByFromDomain = {
  "capitalrise.com": "capitalrise",
};

/**
 * @param {{ id: string, from: string, subject: string, body: string }} dealEmail
 * @returns {Promise<Record<string, unknown>>} raw scraped deal data
 */
export async function scrapeDealFromEmail(dealEmail) {
  const source = identifySource(dealEmail);
  const loadScraper = scrapersBySource[source];
  if (!loadScraper) {
    throw new Error(`No scraper registered for source: ${source ?? "unknown"}`);
  }
  const { scrapeDeal } = await loadScraper();
  return scrapeDeal(dealEmail);
}

/**
 * @param {{ from: string, subject: string, body: string }} dealEmail
 * @returns {string | undefined} a key into scrapersBySource
 */
function identifySource(dealEmail) {
  const domain = dealEmail.from.match(/@([\w.-]+)/)?.[1]?.toLowerCase();
  return domain ? sourcesByFromDomain[domain] : undefined;
}
