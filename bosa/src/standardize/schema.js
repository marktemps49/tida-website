// The standard deal shape Bosa produces for TAPP. Field list is a
// placeholder — replace with TAPP's actual expected schema once confirmed
// (see bosa/CLAUDE.md open items).

/**
 * @typedef {Object} StandardDeal
 * @property {string} dealId
 * @property {string} source
 * @property {string} propertyAddress
 * @property {number} loanAmount
 * @property {number} interestRate
 * @property {string} termMonths
 * @property {string} scrapedAt  ISO timestamp
 */

/**
 * @param {Record<string, unknown>} rawDeal
 * @returns {StandardDeal}
 */
export function standardizeDeal(rawDeal) {
  throw new Error("standardizeDeal: mapping not yet defined for this source's raw shape");
}
