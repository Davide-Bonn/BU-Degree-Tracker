import fs from "fs";
import path from "path";

const LOG_PATH = path.join(process.cwd(), "data", "scrape-log.json");

export interface ScrapeLog {
  coursesLastScraped: string | null; // ISO 8601 date string, or null if never
  rmpLastScraped: string | null;
  requirementsLastChecked: string | null;
}

export function readScrapeLog(): ScrapeLog {
  try {
    const raw = fs.readFileSync(LOG_PATH, "utf-8");
    return JSON.parse(raw) as ScrapeLog;
  } catch {
    return { coursesLastScraped: null, rmpLastScraped: null, requirementsLastChecked: null };
  }
}

export function updateScrapeLog(update: Partial<ScrapeLog>): void {
  const current = readScrapeLog();
  const updated: ScrapeLog = { ...current, ...update };
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(updated, null, 2) + "\n");
}

/** Returns true if the last scrape was more than `staleDays` ago (or never). */
export function shouldRescrape(lastScraped: string | null, staleDays: number): boolean {
  if (!lastScraped) return true;
  const last = new Date(lastScraped);
  const diffMs = Date.now() - last.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= staleDays;
}
