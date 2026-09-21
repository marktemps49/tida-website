// The standard deal shape Bosa produces for TAPP. Field list is a
// best-effort guess based on what CapitalRise actually exposes — replace
// with TAPP's real expected schema once confirmed (see bosa/CLAUDE.md open
// items). `extra` carries anything scraped that doesn't fit the core
// fields, so nothing is dropped while the schema is still unsettled.

/**
 * @typedef {Object} StandardDeal
 * @property {string} dealId
 * @property {string} source
 * @property {string} propertyAddress
 * @property {number | undefined} loanAmount
 * @property {number | undefined} interestRate   percent, e.g. 10.2
 * @property {string | undefined} termMonths      e.g. "12-18" (often a range)
 * @property {string} scrapedAt                   ISO timestamp
 * @property {Record<string, unknown>} extra
 */

const standardizers = {
  capitalrise: standardizeCapitalRiseDeal,
};

/**
 * @param {Record<string, unknown>} rawDeal
 * @returns {StandardDeal}
 */
export function standardizeDeal(rawDeal) {
  const standardize = standardizers[rawDeal.source];
  if (!standardize) {
    throw new Error(`No standardizer for source: ${rawDeal.source ?? "unknown"}`);
  }
  return standardize(rawDeal);
}

/** @param {Record<string, unknown>} rawDeal */
function standardizeCapitalRiseDeal(rawDeal) {
  const dealId = decodeURIComponent(rawDeal.dealUrl.split("/").pop());

  return {
    dealId,
    source: "capitalrise",
    propertyAddress: rawDeal.title,
    // TODO: loan amount isn't in the notification email or (as far as
    // confirmed) the highlights table — check the full deal page for it.
    loanAmount: undefined,
    interestRate: parsePercent(rawDeal["Forecast Net Return"]),
    termMonths: parseTermRange(rawDeal["Estimated Term"]),
    scrapedAt: new Date().toISOString(),
    extra: {
      dealUrl: rawDeal.dealUrl,
      ltvAtExit: rawDeal["Anticipated LTV at Exit"],
      ifisaEligible: rawDeal["IFISA Eligible"],
      legalCharge: rawDeal["Legal Charge"],
      loanType: rawDeal["Loan Type"],
    },
  };
}

/** @param {string | undefined} text e.g. "10.20% p.a." */
function parsePercent(text) {
  const match = text?.match(/([\d.]+)\s*%/);
  return match ? Number(match[1]) : undefined;
}

/** @param {string | undefined} text e.g. "12-18 months" */
function parseTermRange(text) {
  const match = text?.match(/(\d+(?:\s*-\s*\d+)?)\s*months/i);
  return match ? match[1].replace(/\s+/g, "") : text;
}
