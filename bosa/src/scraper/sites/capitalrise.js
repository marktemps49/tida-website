// CapitalRise scraper: loads a pre-authenticated session (see
// scripts/capitalrise-save-session.js), opens the deal linked from the
// notification email, and reads everything needed to build a TAPP
// Investor Paper (see standardize/capitalrise.js for the target shape).
//
// Automated form login does NOT work here — a live run confirmed
// CapitalRise's login is behind reCAPTCHA, which rejects the automated
// submission silently (form just re-displays, no error, no URL change).
// Attempting to defeat that (CAPTCHA-solving services, fingerprint
// spoofing, etc.) isn't something this project does — it would mean
// circumventing an anti-bot measure CapitalRise deliberately put on their
// platform. Instead, a human logs in once by hand (solving the CAPTCHA
// themselves) via scripts/capitalrise-save-session.js, which saves that
// authenticated session; this scraper just reuses it. See CLAUDE.md
// "Sources > CapitalRise" for the full story of how this was found.

import { chromium } from "playwright";

const BASE_URL = "https://www.capitalrise.com";
const LOGGED_OUT_MARKER = /must be a member, and logged in/i;

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

  const sessionStateJson = process.env.SOURCE_CAPITALRISE_SESSION_STATE;
  if (!sessionStateJson) {
    throw new Error(
      "Missing SOURCE_CAPITALRISE_SESSION_STATE — run " +
        "scripts/capitalrise-save-session.js on a machine with a real " +
        "display to generate one (see CLAUDE.md)"
    );
  }
  let storageState;
  try {
    storageState = JSON.parse(sessionStateJson);
  } catch (err) {
    throw new Error(`SOURCE_CAPITALRISE_SESSION_STATE isn't valid JSON: ${err.message}`);
  }

  // PLAYWRIGHT_CHROMIUM_PATH is only needed in environments (like this dev
  // sandbox) that pre-bundle a Chromium build Playwright's installed
  // version doesn't expect. Leave unset for a normal deployment where
  // `npx playwright install` has provisioned the browser Playwright wants.
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  try {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await page.goto(dealUrl, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await waitForContentReady(page);

    const pageTitle = await readPageTitle(page);
    const bodyText = await page.innerText("body");
    if (process.env.BOSA_DEBUG_DUMP_PAGE_TEXT === "1") {
      console.log(`--- RAW page.innerText("body") for ${dealUrl} ---`);
      console.log(bodyText);
      console.log("--- END RAW ---");
    }

    if (LOGGED_OUT_MARKER.test(bodyText)) {
      throw new Error(
        "Saved CapitalRise session is expired or invalid (deal page shows the " +
          "logged-out teaser) — re-run scripts/capitalrise-save-session.js and " +
          "update the SOURCE_CAPITALRISE_SESSION_STATE secret"
      );
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

/** Best-effort dismissal of a cookie-consent overlay, if one is shown. */
async function dismissCookieBanner(page) {
  const candidates = [
    page.getByRole("button", { name: /accept all/i }),
    page.getByRole("button", { name: /accept cookies/i }),
    page.getByRole("button", { name: /^accept$/i }),
  ];
  for (const button of candidates) {
    if ((await button.count()) > 0 && (await button.first().isVisible().catch(() => false))) {
      await button.first().click().catch(() => {});
      return;
    }
  }
}

/**
 * Waits for a sign that the deal page's dynamic content (the highlights
 * table) has actually rendered, rather than trusting domcontentloaded/
 * networkidle timing. Falls back to proceeding anyway (with a warning) if
 * the expected text never shows up, so a wrong guess here doesn't hard-fail
 * the whole scrape — it'll just be visible in the extracted fields being
 * empty, same as before, but with a clearer cause in the logs.
 */
async function waitForContentReady(page) {
  await page
    .getByText("Investment Highlights", { exact: false })
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {
      console.warn(
        'waitForContentReady: "Investment Highlights" never appeared within 15s — ' +
          "proceeding anyway, but scraped fields are likely to be empty/wrong"
      );
    });
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
 * plain text. A browser's innerText renders most adjacent table cells
 * tab-separated on one line ("Label\tValue"); "Anticipated LTV at exit" is
 * a confirmed exception on the real page — its label and value land on
 * separate lines with one or two blank lines between them (verified
 * against a live run) — so the fallback skips blank lines forward from the
 * label until it finds a non-empty one, rather than assuming exactly one
 * line of separation.
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
    if (index === -1) continue;
    for (let j = index + 1; j < lines.length; j++) {
      if (lines[j] !== "") {
        highlights[label] = lines[j];
        break;
      }
    }
  }
  return highlights;
}

/**
 * Reads the Risks table's two columns (risk title/description, then how it
 * applies to the investor). Confirmed working against a live run — the
 * `table tr` selector matches, including the table's own header row
 * ("Risks" / "How this applies to you"), which is filtered out below.
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
    if (/^risks?$/i.test(title.trim())) continue; // the table's own header row
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
