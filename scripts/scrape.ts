import { PrismaClient } from "@prisma/client";
import { scrapeAllCourses } from "../src/lib/scraper/orchestrator";
import { updateScrapeLog } from "../src/lib/scraper/scrape-log";
import { SCHOOLS } from "../src/lib/scraper/listing-parser";

const prisma = new PrismaClient();

/**
 * BU course scraper — all schools.
 *
 * Usage:
 *   npx tsx scripts/scrape.ts                   # scrape ALL schools (empty schools first)
 *   npx tsx scripts/scrape.ts cas               # only CAS
 *   npx tsx scripts/scrape.ts cas com eng       # CAS, COM, and ENG
 *
 * Valid school slugs:
 *   cas, cds, com, eng, qst, sar, sha, sph, ssw, sth, met, cfa, cgs, wheelock, law, grs
 */
async function main() {
  const args = process.argv.slice(2);
  const validSlugs = new Set(SCHOOLS.map((s) => s.slug));

  // Separate valid school slugs from unknown args
  const schools: string[] = [];
  const unknown: string[] = [];
  for (const arg of args) {
    if (validSlugs.has(arg.toLowerCase())) {
      schools.push(arg.toLowerCase());
    } else {
      unknown.push(arg);
    }
  }

  if (unknown.length > 0) {
    console.warn(`Unknown argument(s): ${unknown.join(", ")}`);
    console.warn(`Valid school slugs: ${[...validSlugs].join(", ")}`);
  }

  if (schools.length > 0) {
    console.log(`Starting BU scraper for school(s): ${schools.join(", ")}\n`);
  } else {
    console.log("Starting BU scraper for ALL schools (empty schools first)...\n");
  }

  await scrapeAllCourses(prisma, schools.length > 0 ? { schools } : {});
  await updateScrapeLog({ coursesLastScraped: new Date().toISOString() });
  console.log("Scrape log updated.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Scraper failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
