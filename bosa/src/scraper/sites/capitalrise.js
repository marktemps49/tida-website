// CapitalRise scraper: logs in, opens the deal linked from the
// notification email, and reads everything needed to build a TAPP
// Investor Paper (see standardize/capitalrise.js for the target shape).
//
// IMPORTANT: this sandbox's network egress is blocked to capitalrise.com
// (organization policy), so nothing below has run against the real
// login/deal pages. It's written from a real deal page's content, pasted
// by the user (see src/scraper/sites/__fixtures__/capitalrise-bourne-end.txt),
// but the actual DOM structure — table markup, class names, image
// containers — is unknown. Whoever runs Bosa from an environment with
// real internet access needs to open a real deal page, compare it against
// the selectors here, and fix what doesn't match (see CLAUDE.md "Open
// items"). The prose-section and highlights-table parsing works off the
// page's plain text (page.innerText), which is more resilient to markup
// changes than per-field CSS selectors; only login() and the risks-table
// and hero-image lookups depend on actual DOM structure.

import { chromium } from "playwright";

const BASE_URL = "https://www.capitalrise.com";

const HIGHLIGHT_LABELS = [
  "Net forecast annual return",
  "Total loan amount",
  "Total CapitalRise investor raise",
  "Estimated term",
  "Anticipated LTV at exit",
  "ISA",
  "Product",
];

const SECTION_LABELS = ["PLAN", "TERM", "LOCATION", "PROPERTY", "THE SECURITY"];

/**
 * @param {{ id: string, from: string, subject: string, body: string, htmlBody?: string }} dealEmail
 * @returns {Promise<Record<string, unknown>>} raw deal data — see standardize/capitalrise.js
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

  // PLAYWRIGHT_CHROMIUM_PATH is only needed in environments (like this dev
  // sandbox) that pre-bundle a Chromium build Playwright's installed
  // version doesn't expect. Leave unset for a normal deployment where
  // `npx playwright install` has provisioned the browser Playwright wants.
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    await login(page, email, password);
    await page.goto(dealUrl, { waitUntil: "networkidle" });

    const pageTitle = await readPageTitle(page);
    const bodyText = await page.innerText("body");
    if (process.env.BOSA_DEBUG_DUMP_PAGE_TEXT === "1") {
      console.log(`--- RAW page.innerText("body") for ${dealUrl} ---`);
      console.log(bodyText);
      console.log("--- END RAW ---");
    }
    const sections = extractSections(bodyText);
    const highlights = extractHighlights(bodyText);
    const risks = await extractRisks(page);
    const heroImageUrls = await extractHeroImages(page);

    return {
      source: "capitalrise",
      dealUrl,
      pageTitle,
      planText: sections.PLAN ?? "",
      locationText: sections.LOCATION ?? "",
      propertyText: sections.PROPERTY ?? "",
      securityText: sections["THE SECURITY"] ?? "",
      highlights,
      heroImageUrls,
      risks,
    };
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
  // The login page also has a (hidden) registration form sharing generic
  // input types/names — a real run found page.fill() silently picking the
  // invisible "RegisterForm[password]" field and timing out. `:visible` is
  // a Playwright CSS extension that disambiguates by picking only the
  // currently-shown field, regardless of how many matches share the
  // selector otherwise.
  await page.fill('input[type="email"]:visible, input[name="email"]:visible', email);
  await page.fill('input[type="password"]:visible, input[name="password"]:visible', password);
  await page.click('button[type="submit"]:visible');
  await page.waitForLoadState("networkidle");
}

async function readPageTitle(page) {
  const h1 = page.locator("h1").first();
  if ((await h1.count()) > 0) return (await h1.textContent())?.trim();
  return page.title();
}

/**
 * Splits the Investment Summary's flowing "LABEL – text LABEL2 – text ..."
 * paragraph into { LABEL: text }, using SECTION_LABELS as the split points.
 * @param {string} text
 */
export function extractSections(text) {
  const sections = {};
  for (let i = 0; i < SECTION_LABELS.length; i++) {
    const label = SECTION_LABELS[i];
    const nextLabels = SECTION_LABELS.slice(i + 1).join("|");
    const pattern = new RegExp(
      `${label}\\s*[–-]\\s*([\\s\\S]*?)(?=(?:${nextLabels || "$^"})\\s*[–-]|$)`,
      "m"
    );
    const match = text.match(pattern);
    if (match) sections[label] = match[1].trim();
  }
  return sections;
}

/**
 * Reads the "Investment Highlights" label/value pairs out of the page's
 * plain text. A browser's innerText renders adjacent table cells
 * tab-separated on one line ("Label\tValue"); falls back to checking the
 * next line in case the real markup renders them as separate blocks.
 * @param {string} text
 */
export function extractHighlights(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const highlights = {};
  for (const label of HIGHLIGHT_LABELS) {
    const sameLine = lines.find((line) => line.startsWith(`${label}\t`));
    if (sameLine) {
      highlights[label] = sameLine.slice(label.length + 1).trim();
      continue;
    }
    const index = lines.findIndex((line) => line === label);
    if (index !== -1 && index + 1 < lines.length) {
      highlights[label] = lines[index + 1];
    }
  }
  return highlights;
}

/**
 * TODO: unverified — assumes the Risks section is a <table> with two
 * columns (risk title/description, then how it applies to the investor).
 * Adjust the selector once the real markup is known.
 */
async function extractRisks(page) {
  const rows = page.locator("table tr", { hasText: "Risk" });
  const count = await rows.count();
  const risks = [];
  for (let i = 0; i < count; i++) {
    const cells = rows.nth(i).locator("td, th");
    if ((await cells.count()) < 2) continue;
    const left = (await cells.nth(0).textContent())?.trim() ?? "";
    const appliesToYou = (await cells.nth(1).textContent())?.trim() ?? "";
    const [title, ...rest] = left.split(/[–-]/);
    if (!title) continue;
    risks.push({
      title: title.trim(),
      description: rest.join("-").trim(),
      appliesToYou,
    });
  }
  return risks;
}

/**
 * TODO: unverified — assumes hero/gallery images are inside a carousel-like
 * container near the top of the deal page. Adjust once the real markup is
 * known; this is likely to need the most fixing up of anything here.
 */
async function extractHeroImages(page) {
  const images = page.locator('[class*="gallery"] img, [class*="carousel"] img');
  const count = await images.count();
  const urls = [];
  for (let i = 0; i < count; i++) {
    const src = await images.nth(i).getAttribute("src");
    if (src) urls.push(src);
  }
  return urls;
}
