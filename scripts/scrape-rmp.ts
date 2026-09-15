/**
 * Scrape RateMyProfessors ratings for all instructors in the CourseSchedule table.
 * Uses the shared scrapeRMP library function.
 *
 * Run with:  npx tsx scripts/scrape-rmp.ts
 */

import { PrismaClient } from "@prisma/client";
import { scrapeRMP } from "../src/lib/scraper/scrape-rmp";
import { updateScrapeLog } from "../src/lib/scraper/scrape-log";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting RMP scrape...\n");
  const result = await scrapeRMP(prisma);
  console.log(`\nDone: ${result.found} found, ${result.notFound} not found, ${result.errors} errors`);
  await updateScrapeLog({ rmpLastScraped: new Date().toISOString() });
  console.log("Scrape log updated.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
