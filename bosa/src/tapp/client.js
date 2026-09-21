// Loads a standardized deal into TAPP (TIDA Private Client App), a separate
// application in its own repo. The JSON shape TAPP needs is confirmed (see
// standardize/capitalrise.js's TappInvestorPaper and CLAUDE.md) — what's
// still missing is how to deliver it: TAPP's API endpoint, auth, and
// whether it's a single "create investor paper" call or something more
// involved (e.g. separate calls for hero image upload). See CLAUDE.md
// "Open items".

/**
 * @param {import("../standardize/capitalrise.js").TappInvestorPaper} deal
 * @returns {Promise<void>}
 */
export async function loadDealIntoTapp(deal) {
  throw new Error(
    "loadDealIntoTapp: TAPP's API endpoint/auth aren't configured yet — see CLAUDE.md"
  );
}
