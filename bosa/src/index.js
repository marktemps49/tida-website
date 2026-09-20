import "dotenv/config";
import { watchForDealEmails } from "./gmail/watcher.js";
import { scrapeDealFromEmail } from "./scraper/index.js";
import { standardizeDeal } from "./standardize/schema.js";
import { loadDealIntoTapp } from "./tapp/client.js";

async function main() {
  const dealEmails = await watchForDealEmails();
  for await (const dealEmail of dealEmails) {
    try {
      const rawDeal = await scrapeDealFromEmail(dealEmail);
      const deal = standardizeDeal(rawDeal);
      await loadDealIntoTapp(deal);
      console.log(`Loaded deal ${deal.dealId} into TAPP`);
    } catch (err) {
      console.error(`Failed to process deal email ${dealEmail.id}:`, err);
    }
  }
}

main();
