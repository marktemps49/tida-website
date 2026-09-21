// Maps CapitalRise's raw scraped deal content to the JSON shape TAPP's
// "Investor Paper" needs (see bosa/CLAUDE.md — derived from screenshots of
// TAPP's admin form and its mobile preview).
//
// This is a pure function: given the same shape scraper/sites/capitalrise.js
// produces, it's fully testable without touching the network (see
// bosa/CLAUDE.md for how it was verified against the real Bourne End deal).

/**
 * @typedef {Object} CapitalRiseRawDeal
 * @property {string} dealUrl
 * @property {string} pageTitle              e.g. "Bourne End, Buckinghamshire - Bridge Loan"
 * @property {string} planText               "Investment Summary" PLAN paragraph, no "PLAN – " prefix
 * @property {string} locationText           LOCATION paragraph, no "LOCATION – " prefix
 * @property {string} propertyText           PROPERTY paragraph, no "PROPERTY – " prefix
 * @property {string} securityText           THE SECURITY paragraph, no prefix
 * @property {Record<string, string>} highlights  "Investment Highlights" table, keyed by label
 * @property {string[]} heroImageUrls
 * @property {{ title: string, description: string, appliesToYou: string }[]} risks
 */

/**
 * @typedef {Object} TappInvestorPaper
 * @property {string} name
 * @property {string} summary
 * @property {number | undefined} irr           percent, e.g. 10.2
 * @property {number | undefined} ltv           percent, e.g. 75
 * @property {number | undefined} ltc           percent — TODO, see bosa/CLAUDE.md
 * @property {string | undefined} type          e.g. "1st charge"
 * @property {string} sector                    e.g. "Residential"
 * @property {number | undefined} termMonths    e.g. 12 (lower bound of a range)
 * @property {"London" | "Outside London"} location
 * @property {string} city
 * @property {string[]} heroImages
 * @property {{ title: string, description: string, mitigation: string, severity: string }[]} keyRisks
 */

/**
 * @param {CapitalRiseRawDeal} raw
 * @returns {TappInvestorPaper}
 */
export function standardizeCapitalRiseDeal(raw) {
  const city = raw.pageTitle.split(" - ")[0].trim();

  return {
    name: city,
    summary: firstSentences(raw.planText, 2),
    irr: parsePercent(raw.highlights["Net forecast annual return"]),
    ltv: parsePercent(raw.highlights["Anticipated LTV at exit"]),
    // TODO: LTC (loan-to-cost) isn't present anywhere in CapitalRise's
    // notification email or deal page content gathered so far — the
    // "day one LTV" mentioned in the LOAN TO VALUE section (68% for
    // Bourne End) is a different metric and doesn't match the 65.0
    // shown in the TAPP form example. Needs clarifying where this
    // should come from before it can be automated.
    ltc: undefined,
    type: inferChargeType(raw.securityText),
    sector: inferSector(raw.propertyText),
    termMonths: parseFirstTermMonths(raw.highlights["Estimated term"]),
    // TODO: heuristic only (checks for "London" in the city name), since
    // neither the email nor the deal page states this as a flag anywhere
    // seen so far — CapitalRise covers "London and the Home Counties", so
    // a Greater London borough deal (e.g. "Chelsea") wouldn't match this.
    location: /london/i.test(city) ? "London" : "Outside London",
    city,
    heroImages: raw.heroImageUrls,
    keyRisks: raw.risks.map((risk) => ({
      title: risk.title,
      description: risk.description,
      mitigation: risk.appliesToYou,
      // TODO: CapitalRise's own risk table has no severity rating —
      // defaulting to Medium until there's a real source for this
      // (or a human sets it after the fact in TAPP).
      severity: "Medium",
    })),
  };
}

/** @param {string} text @param {number} count */
function firstSentences(text, count) {
  const sentences = text.split(/(?<=\.)\s+/).slice(0, count);
  return sentences.join(" ").trim();
}

/** @param {string | undefined} text e.g. "10.20% p.a. paid at the end of the term" */
function parsePercent(text) {
  const match = text?.match(/([\d.]+)\s*%/);
  return match ? Number(match[1]) : undefined;
}

/** @param {string | undefined} text e.g. "12-18 months (August 2027 - February 2028)" */
function parseFirstTermMonths(text) {
  const match = text?.match(/(\d+)\s*(?:-\s*\d+)?\s*months/i);
  return match ? Number(match[1]) : undefined;
}

/** @param {string} securityText */
function inferChargeType(securityText) {
  if (/first legal charge/i.test(securityText)) return "1st charge";
  if (/second legal charge/i.test(securityText)) return "2nd charge";
  if (/mezzanine/i.test(securityText)) return "Mezzanine";
  return undefined;
}

/** @param {string} propertyText */
function inferSector(propertyText) {
  if (/\b(house|houses|residential|flat|flats|apartment)\b/i.test(propertyText)) {
    return "Residential";
  }
  if (/\b(office|retail|commercial|industrial)\b/i.test(propertyText)) {
    return "Commercial";
  }
  return undefined;
}
