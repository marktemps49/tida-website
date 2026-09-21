// Dispatches raw scraped deal data to the right source-specific
// standardizer, which maps it to the JSON shape TAPP's Investor Paper
// needs. Add one module per source under src/standardize/ as new firms
// are onboarded (see CLAUDE.md).

import { standardizeCapitalRiseDeal } from "./capitalrise.js";

const standardizers = {
  capitalrise: standardizeCapitalRiseDeal,
};

/**
 * @param {Record<string, unknown>} rawDeal
 * @returns {import("./capitalrise.js").TappInvestorPaper}
 */
export function standardizeDeal(rawDeal) {
  const standardize = standardizers[rawDeal.source];
  if (!standardize) {
    throw new Error(`No standardizer for source: ${rawDeal.source ?? "unknown"}`);
  }
  return standardize(rawDeal);
}
