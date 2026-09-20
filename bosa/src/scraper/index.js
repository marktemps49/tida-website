// Given a deal email, identifies its source website and dispatches to that
// site's scraper. Add one module per source under src/scraper/sites/ and
// register it below as source sites are confirmed.

const scrapersBySource = {
  // acme: () => import("./sites/acme.js"),
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
  // TODO: implement once the set of source websites and how their emails
  // are distinguished (sender domain, subject pattern, etc.) is known.
  return undefined;
}
