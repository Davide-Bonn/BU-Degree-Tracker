/**
 * check-requirements.ts
 *
 * Monitors BU bulletin pages for changes to graduation requirements.
 * Fetches HTML, extracts text, compares SHA-256 hashes against snapshots,
 * and prints diffs when changes are detected.
 *
 * Usage:
 *   npx tsx scripts/check-requirements.ts          # check all pages
 *   npx tsx scripts/check-requirements.ts cas eng  # check specific schools
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { load } from "cheerio";
import { updateScrapeLog } from "../src/lib/scraper/scrape-log";

const BASE_URL = "https://www.bu.edu";

interface PageDef {
  id: string;
  label: string;
  url: string;
}

const PAGES: PageDef[] = [
  { id: "cas",                   label: "CAS — College of Arts & Sciences",            url: `${BASE_URL}/academics/cas/programs/` },
  { id: "cas-intl-relations-ba", label: "CAS/Pardee — International Relations BA",      url: `${BASE_URL}/academics/cas/programs/international-relations/` },
  { id: "cds",                   label: "CDS — Computing & Data Sciences",              url: `${BASE_URL}/academics/cds/programs/` },
  { id: "eng",                   label: "ENG — College of Engineering",                 url: `${BASE_URL}/academics/eng/programs/` },
  { id: "com",                   label: "COM — College of Communication",               url: `${BASE_URL}/academics/com/programs/` },
  { id: "sar",                   label: "SAR — Sargent College",                        url: `${BASE_URL}/academics/sar/programs/` },
  { id: "sha",                   label: "SHA — School of Hospitality Administration",   url: `${BASE_URL}/academics/sha/programs/` },
  { id: "sph",                   label: "SPH — School of Public Health",                url: `${BASE_URL}/academics/sph/programs/` },
  { id: "ssw",                   label: "SSW — School of Social Work",                  url: `${BASE_URL}/academics/ssw/programs/` },
  { id: "cfa",                   label: "CFA — College of Fine Arts",                   url: `${BASE_URL}/academics/cfa/programs/` },
  { id: "wheelock",              label: "Wheelock — Education & Human Development",     url: `${BASE_URL}/academics/wheelock/programs/` },
  { id: "qst",                   label: "QST — Questrom School of Business",            url: `${BASE_URL}/academics/qst/programs/` },
];

interface Snapshot {
  url: string;
  label: string;
  lastChecked: string;
  contentHash: string;
  extractedText: string;
}

type SnapshotFile = Record<string, Snapshot>;

const SNAPSHOT_PATH = path.join(process.cwd(), "data", "requirement-snapshots.json");

function readSnapshots(): SnapshotFile {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8")) as SnapshotFile;
  } catch {
    return {};
  }
}

function writeSnapshots(data: SnapshotFile): void {
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(data, null, 2) + "\n");
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text.slice(0, 16384)).digest("hex");
}

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "BU-Course-Dashboard/1.0" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function fetchWithRetry(url: string): Promise<string> {
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
      const result = await fetchUrl(url);
      await new Promise((r) => setTimeout(r, 500));
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`  Attempt ${attempt + 1} failed: ${lastError.message}`);
    }
  }
  throw lastError;
}

function extractText(html: string): string {
  const $ = load(html);
  // Remove navigation, footers, scripts, styles
  $("nav, footer, script, style, .nav, .footer, .header, header, [role='navigation'], [role='banner']").remove();
  // Extract from main content selectors
  const contentEl = $("#content, main, [role='main'], .main-content, .page-content, body").first();
  const lines: string[] = [];
  contentEl.find("h1, h2, h3, h4, h5, h6, p, li").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 10) lines.push(text);
  });
  return lines.join("\n");
}

function diffLines(oldText: string, newText: string): { added: string[]; removed: string[] } {
  const oldLines = new Set(oldText.split("\n").filter(Boolean));
  const newLines = new Set(newText.split("\n").filter(Boolean));
  const added = [...newLines].filter((l) => !oldLines.has(l));
  const removed = [...oldLines].filter((l) => !newLines.has(l));
  return { added, removed };
}

async function checkPage(page: PageDef, snapshots: SnapshotFile): Promise<boolean> {
  console.log(`\nChecking ${page.label} ...`);
  let html: string;
  try {
    html = await fetchWithRetry(page.url);
  } catch (err) {
    console.error(`  ERROR fetching ${page.url}: ${(err as Error).message}`);
    return false;
  }

  const extractedText = extractText(html);
  const contentHash = sha256(extractedText);
  const now = new Date().toISOString();

  const existing = snapshots[page.id];

  if (!existing) {
    snapshots[page.id] = { url: page.url, label: page.label, lastChecked: now, contentHash, extractedText };
    console.log(`  Snapshot created (hash: ${contentHash.slice(0, 12)}...)`);
    return false;
  }

  snapshots[page.id] = { ...existing, lastChecked: now };

  if (existing.contentHash === contentHash) {
    console.log(`  No changes (hash: ${contentHash.slice(0, 12)}...)`);
    return false;
  }

  // Hash changed — compute diff
  const { added, removed } = diffLines(existing.extractedText, extractedText);
  console.log(`  *** CHANGE DETECTED for ${page.label} ***`);
  console.log(`  Old hash: ${existing.contentHash.slice(0, 12)}...  New hash: ${contentHash.slice(0, 12)}...`);
  console.log(`  → Update school-requirements.ts for program code: "${page.id}"`);

  if (removed.length > 0) {
    console.log("\n  REMOVED lines:");
    removed.slice(0, 20).forEach((l) => console.log(`    - ${l.slice(0, 120)}`));
    if (removed.length > 20) console.log(`    ... and ${removed.length - 20} more`);
  }
  if (added.length > 0) {
    console.log("\n  ADDED lines:");
    added.slice(0, 20).forEach((l) => console.log(`    + ${l.slice(0, 120)}`));
    if (added.length > 20) console.log(`    ... and ${added.length - 20} more`);
  }

  // Update snapshot with new content
  snapshots[page.id] = { url: page.url, label: page.label, lastChecked: now, contentHash, extractedText };
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const validIds = new Set(PAGES.map((p) => p.id));

  let pagesToCheck: PageDef[];
  if (args.length === 0) {
    pagesToCheck = PAGES;
  } else {
    const unknown = args.filter((a) => !validIds.has(a));
    if (unknown.length > 0) {
      console.error(`Unknown page ID(s): ${unknown.join(", ")}`);
      console.error(`Valid IDs: ${[...validIds].join(", ")}`);
      process.exit(1);
    }
    pagesToCheck = PAGES.filter((p) => args.includes(p.id));
  }

  console.log(`Checking ${pagesToCheck.length} BU bulletin page(s) for requirement changes...`);

  const snapshots = readSnapshots();
  let changesDetected = 0;

  for (const page of pagesToCheck) {
    const changed = await checkPage(page, snapshots);
    if (changed) changesDetected++;
  }

  writeSnapshots(snapshots);
  updateScrapeLog({ requirementsLastChecked: new Date().toISOString() });

  console.log(`\nDone. ${changesDetected} page(s) changed. Snapshot file updated.`);
  if (changesDetected > 0) {
    console.log("Action required: review the diffs above and update src/lib/school-requirements.ts accordingly.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
