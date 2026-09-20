// Loads a standardized deal into TAPP (TIDA Private Client App), a separate
// application in its own repo. Integration method (REST API, file drop,
// direct DB write, etc.) is TBD — see bosa/CLAUDE.md open items.

/**
 * @param {import("../standardize/schema.js").StandardDeal} deal
 * @returns {Promise<void>}
 */
export async function loadDealIntoTapp(deal) {
  throw new Error("loadDealIntoTapp: TAPP integration not yet defined");
}
