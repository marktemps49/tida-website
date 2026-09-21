import "dotenv/config";
import { watchForDealEmails, markDealEmailProcessed } from "./gmail/watcher.js";
import { scrapeDealFromEmail } from "./scraper/index.js";
import { standardizeDeal } from "./standardize/schema.js";
import { loadDealIntoTapp } from "./tapp/client.js";

async function main() {
  // Optional cap for testing (e.g. BOSA_MAX_DEALS=1) so a first run against
  // a real backlog doesn't attempt every deal at once. Unset in normal
  // operation.
  const maxDeals = process.env.BOSA_MAX_DEALS ? Number(process.env.BOSA_MAX_DEALS) : Infinity;

  const dealEmails = await watchForDealEmails();
  let processed = 0;
  for await (const dealEmail of dealEmails) {
    if (processed >= maxDeals) break;
    processed++;
    try {
      const rawDeal = await scrapeDealFromEmail(dealEmail);
      const deal = standardizeDeal(rawDeal);
      console.log(`Standardized deal for ${dealEmail.subject}:`, JSON.stringify(deal, null, 2));
      await loadDealIntoTapp(deal);
      await markDealEmailProcessed(dealEmail.id);
      console.log(`Loaded deal "${deal.name}" into TAPP`);
    } catch (err) {
      console.error(`Failed to process deal email ${dealEmail.id}:`, err);
    }
  }
}

main();
