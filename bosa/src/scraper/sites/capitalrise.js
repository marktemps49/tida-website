// CapitalRise scraper: logs in, opens the deal linked from the
// notification email, and reads its investment-highlights fields.
//
// IMPORTANT: this sandbox's network egress is blocked to capitalrise.com
// (organization policy), so the selectors below are written from the
// notification email's content and CapitalRise's public site structure —
// they have NOT been run against the real login/deal pages. Run this from
// an environment with normal internet access and fix up any selector that
// doesn't match (see CLAUDE.md "Open items").

import { chromium } from "playwright";

const BASE_URL = "https://www.capitalrise.com";

// Labels as they appear in CapitalRise's "INVESTMENT HIGHLIGHTS" table,
// taken from the notification email (see bosa/CLAUDE.md).
const HIGHLIGHT_LABELS = [
  "Forecast Net Return",
  "Estimated Term",
  "Anticipated LTV at Exit",
  "IFISA Eligible",
  "Legal Charge",
  "Loan Type",
];

/**
 * @param {{ id: string, from: string, subject: string, body: string, htmlBody?: string }} dealEmail
 * @returns {Promise<Record<string, unknown>>} raw scraped deal data
 */
export async function scrapeDeal(dealEmail) {
  const dealUrl = extractDealUrl(dealEmail.htmlBody ?? dealEmail.body);
  if (!dealUrl) {
    throw new Error(
      "Could not find a capitalrise.com/property-investment/... link in the deal email"
    );
  }

  const email = process.env.SOURCE_CAPITALRISE_EMAIL;
  const password = process.env.SOURCE_CAPITALRISE_PASSWORD;
  if (!email || !password) {
    throw new Error("Missing SOURCE_CAPITALRISE_EMAIL / SOURCE_CAPITALRISE_PASSWORD");
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await login(page, email, password);
    await page.goto(dealUrl, { waitUntil: "networkidle" });
    return await extractDealFields(page, dealUrl);
  } finally {
    await browser.close();
  }
}

/** @param {string} htmlOrText */
export function extractDealUrl(htmlOrText) {
  const match = htmlOrText.match(
    /https:\/\/www\.capitalrise\.com\/property-investment\/[^\s"'<>]+/
  );
  return match?.[0];
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

async function extractDealFields(page, dealUrl) {
  const title = (await page.title()) || slugToTitle(dealUrl);

  const highlights = {};
  for (const label of HIGHLIGHT_LABELS) {
    highlights[label] = await readLabelledValue(page, label);
  }

  return {
    source: "capitalrise",
    dealUrl,
    title,
    ...highlights,
  };
}

async function readLabelledValue(page, label) {
  const locator = page.getByText(label, { exact: false }).first();
  if ((await locator.count()) === 0) return undefined;
  return locator.evaluate((el) => el.nextElementSibling?.textContent?.trim() ?? null);
}

function slugToTitle(dealUrl) {
  return decodeURIComponent(dealUrl.split("/").pop()).replace(/-/g, " ");
}
