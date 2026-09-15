/**
 * LinkedIn screenshot script
 * Usage:  npx tsx scripts/screenshot.ts
 *         npx tsx scripts/screenshot.ts --url https://your-vercel-app.vercel.app
 *
 * Opens a visible browser window. Log in if prompted, then the script
 * automatically visits each page and saves screenshots to linkedin/screenshots/.
 */

import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const OUT  = path.join(ROOT, "linkedin", "screenshots");
fs.mkdirSync(OUT, { recursive: true });

const BASE_URL = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://localhost:3000";

// Pages to capture. slug = filename prefix; route = URL path
const PAGES: { slug: string; route: string; scrollY?: number; waitFor?: string }[] = [
  {
    slug: "01-dashboard",
    route: "/",
    waitFor: '[data-tour="progress-rings"]',
  },
  {
    slug: "02-hub",
    route: "/hub",
    waitFor: '[data-tour="hub-capacity"]',
  },
  {
    slug: "03-courses",
    route: "/courses",
    waitFor: ".course-card, article, [class*='card']",
  },
  {
    slug: "04-planner",
    route: "/planner",
    waitFor: "main",
  },
  {
    slug: "05-programs",
    route: "/programs",
    waitFor: "main",
  },
];

// A few individual courses that tend to have RMP data
// The script will try each and screenshot the first one that loads with ratings
const COURSE_SLUGS = [
  "cs-112",
  "cs-131",
  "cs-237",
  "cs-330",
  "cs-320",
  "ma-225",
];

async function waitForAuth(page: import("playwright").Page) {
  // If we end up on the login or onboarding page, wait for the user to proceed
  const url = page.url();
  if (url.includes("/auth/login") || url.includes("/onboarding")) {
    console.log("\n  ⚠  Login required. Please sign in in the browser window.");
    console.log("     The script will continue automatically after you log in.\n");
    // Wait until we're no longer on an auth page (up to 5 minutes)
    await page.waitForFunction(
      () => !window.location.pathname.startsWith("/auth") && !window.location.pathname.startsWith("/onboarding"),
      undefined,
      { timeout: 300_000 }
    );
    console.log("  ✓  Logged in. Continuing...\n");
    await page.waitForTimeout(1500); // let the page settle
  }
}

/** Click "Skip" on any tour popup that's visible before screenshotting */
async function dismissTour(page: import("playwright").Page) {
  try {
    const skipBtn = page.locator('button:has-text("Skip")').first();
    if (await skipBtn.isVisible({ timeout: 800 })) {
      await skipBtn.click();
      await page.waitForTimeout(400);
    }
  } catch {
    // No tour visible — fine
  }
}

async function shot(
  page: import("playwright").Page,
  slug: string,
  label: string
) {
  const file = path.join(OUT, `${slug}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓  ${label} → ${path.relative(ROOT, file)}`);
  return file;
}

async function main() {
  console.log(`\nBU Suggestor — LinkedIn screenshots`);
  console.log(`Base URL : ${BASE_URL}`);
  console.log(`Output   : ${OUT}\n`);

  const browser = await chromium.launch({
    headless: false,          // visible window so you can log in
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,    // retina-quality output
  });

  const page = await context.newPage();

  // ── Navigate to root, handle auth ─────────────────────────────────────────
  console.log("Opening app...");
  await page.goto(BASE_URL, { waitUntil: "load" });
  await waitForAuth(page);

  // ── Main pages ─────────────────────────────────────────────────────────────
  for (const { slug, route, waitFor } of PAGES) {
    console.log(`  → ${route}`);
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "load" });
    await waitForAuth(page);

    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 15_000 }).catch(() => {
        console.log(`    (selector "${waitFor}" not found, screenshotting anyway)`);
      });
    }
    await page.waitForTimeout(800); // let animations settle
    await dismissTour(page);

    await shot(page, slug, route);
  }

  // ── Course detail with RMP ratings ────────────────────────────────────────
  console.log("\n  Looking for a course page with RMP data...");
  let rmpFound = false;
  for (const slug of COURSE_SLUGS) {
    await page.goto(`${BASE_URL}/courses/${slug}`, { waitUntil: "load" });
    await waitForAuth(page);
    await page.waitForTimeout(600);
    await dismissTour(page);

    // Check if RMP section is present and has at least one rating
    const hasRmp = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("RateMyProfessor") || text.includes("Rating") || text.includes("Difficulty");
    });

    if (hasRmp) {
      await shot(page, "06-course-rmp", `/courses/${slug}`);
      rmpFound = true;
      console.log(`    (used slug: ${slug})`);
      break;
    }
  }
  if (!rmpFound) {
    // Fall back: screenshot whatever course page we're on
    await shot(page, "06-course-rmp", "/courses/[first-available]");
    console.log("    (no RMP data found — generic course page saved)");
  }

  // ── Hub page full scroll ───────────────────────────────────────────────────
  console.log("\n  Hub page — scrolled view...");
  await page.goto(`${BASE_URL}/hub`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  await dismissTour(page);
  await page.evaluate(() => window.scrollBy(0, 300)); // scroll past the progress bar
  await page.waitForTimeout(400);
  await shot(page, "07-hub-scrolled", "/hub (scrolled)");

  // ── Dashboard mobile view ─────────────────────────────────────────────────
  console.log("\n  Dashboard — mobile view...");
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro
  await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  await shot(page, "08-dashboard-mobile", "/ (mobile)");

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`\n  All screenshots saved to: ${OUT}`);
  console.log("  Closing browser in 3 seconds...\n");
  await page.waitForTimeout(3000);
  await browser.close();
}

main().catch((e) => {
  console.error("Screenshot script failed:", e);
  process.exit(1);
});
