// Loads a standardized deal into TAPP (TIDA Private Client App), a separate
// application in its own repo. The JSON payload shape is finalized as a
// *spec* for building TAPP's ingestion endpoint — see
// docs/tapp-investor-paper-spec.md — but that endpoint doesn't exist yet.
// Once it does (URL, auth, response shape all confirmed), this function
// becomes a plain POST of `deal` against it.

/**
 * @param {import("../standardize/capitalrise.js").TappInvestorPaper} deal
 * @returns {Promise<void>}
 */
export async function loadDealIntoTapp(deal) {
  throw new Error(
    "loadDealIntoTapp: TAPP has no ingestion endpoint yet — see docs/tapp-investor-paper-spec.md"
  );
}
