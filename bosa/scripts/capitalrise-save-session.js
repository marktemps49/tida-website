// One-time (and occasional re-run) setup: opens a real, visible browser
// window so you can log into CapitalRise by hand — including solving the
// reCAPTCHA challenge, which Bosa's automated login cannot get past (see
// bosa/CLAUDE.md) — then saves the resulting authenticated session
// (cookies + local storage) to a file. capitalrise.js's scraper loads that
// file instead of trying to log in itself, so the daily automated run
// never touches the login form or its CAPTCHA at all.
//
// MUST be run on a machine with a real display (your own computer) — it
// will not work in this dev sandbox or in GitHub Actions, both of which
// are headless with no way for a human to click through the CAPTCHA.
//
// Usage:
//   cd bosa
//   node scripts/capitalrise-save-session.js
// Then follow the printed instructions.

import { chromium } from "playwright";
import fs from "node:fs";
import readline from "node:readline/promises";

const BASE_URL = "https://www.capitalrise.com";
const OUTPUT_PATH = "capitalrise-session.json";

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE_URL}/login`);

console.log("\nA browser window has opened.");
console.log("1. Log into CapitalRise as normal, including solving the reCAPTCHA if shown.");
console.log("2. Once you're logged in and can see your account/dashboard, come back here.\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question("Press Enter once you're logged in... ");
rl.close();

// Sanity check: an actual deal page should no longer show the "must be a
// member and logged in" teaser once truly authenticated.
await page.goto(`${BASE_URL}/investments-list`);
const bodyText = await page.innerText("body").catch(() => "");
if (/must be a member, and logged in/i.test(bodyText)) {
  console.error(
    "\nStill looks logged out (found the 'must be a member' message on " +
      "investments-list). Log in fully in the browser window, then re-run this script."
  );
  await browser.close();
  process.exit(1);
}

await context.storageState({ path: OUTPUT_PATH });
await browser.close();

console.log(`\nSaved session to ${OUTPUT_PATH}.`);
console.log("Next steps:");
console.log(`1. Copy the contents of ${OUTPUT_PATH}.`);
console.log(
  '2. In GitHub: repo → Settings → Secrets and variables → Actions → paste it as ' +
    'SOURCE_CAPITALRISE_SESSION_STATE (create it if this is the first time, ' +
    "or update the existing one if the old session expired).\n"
);
console.log(
  `Do not commit ${OUTPUT_PATH} to git — it's already in .gitignore, but double-check.`
);
