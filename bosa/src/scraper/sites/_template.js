// Template for a per-source-website scraper. Copy this file to
// src/scraper/sites/<source>.js, implement scrapeDeal, and register it in
// src/scraper/index.js's scrapersBySource map.

import { chromium } from "playwright";

/**
 * @param {{ id: string, from: string, subject: string, body: string }} dealEmail
 * @returns {Promise<Record<string, unknown>>} raw scraped deal data
 */
export async function scrapeDeal(dealEmail) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // TODO: log in, navigate to the deal referenced in dealEmail, and
    // extract the required fields.
    throw new Error("scrapeDeal: not yet implemented for this source");
  } finally {
    await browser.close();
  }
}
