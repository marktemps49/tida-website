// Debug/onboarding helper: search the watched Gmail inbox and print
// matching messages' sender, subject, and body — used to work out a new
// source's email pattern (sender address, subject format) for
// scraper/index.js's identifySource().
//
// Usage:
//   node scripts/gmail-search.js "from:capitalrise.com Bourne End"

import "dotenv/config";
import { getGmailClient, extractHeaders, extractPlainBody, extractLinks } from "../src/gmail/client.js";

const query = process.argv.slice(2).join(" ");
if (!query) {
  console.error('Usage: node scripts/gmail-search.js "<gmail search query>"');
  process.exit(1);
}

const gmail = getGmailClient();

const { data: list } = await gmail.users.messages.list({
  userId: "me",
  q: query,
  maxResults: 5,
});

if (!list.messages?.length) {
  console.log("No messages matched that query.");
  process.exit(0);
}

for (const { id } of list.messages) {
  const { data: msg } = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const headers = extractHeaders(msg.payload);

  console.log("=".repeat(80));
  console.log("From:", headers.from);
  console.log("Subject:", headers.subject);
  console.log("Date:", headers.date);
  console.log("-".repeat(80));
  console.log(extractPlainBody(msg.payload).slice(0, 3000));

  const links = extractLinks(msg.payload);
  if (links.length) {
    console.log("-".repeat(80));
    console.log("Links found in HTML body:");
    links.forEach((l) => console.log(" ", l));
  }
}
