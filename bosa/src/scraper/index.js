// Given a deal email, identifies its source website and dispatches to that
// site's scraper. Add one module per source under src/scraper/sites/,
// register it in scrapersBySource, and add an entry to sourceConfigs as
// new firms are onboarded (see CLAUDE.md).

const scrapersBySource = {
  capitalrise: () => import("./sites/capitalrise.js"),
};

/**
 * One entry per source firm. `gmailSubjectFilter` narrows the watcher's
 * Gmail query to just deal-notification emails (as opposed to other mail
 * from the same sender domain, e.g. newsletters) — see CLAUDE.md for how
 * CapitalRise's was found.
 */
const sourceConfigs = [
  {
    source: "capitalrise",
    fromDomain: "capitalrise.com",
    gmailSubjectFilter: `subject:"NEW INVESTMENT OPPORTUNITY"`,
  },
];

/** Used by the Gmail watcher to build its search query, so source firms
 * only need to be maintained here. */
export const knownSources = sourceConfigs.map(({ fromDomain, gmailSubjectFilter }) => ({
  fromDomain,
  gmailSubjectFilter,
}));

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
  return sourceConfigs.find((c) => c.fromDomain === domain)?.source;
}
