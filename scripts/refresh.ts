/**
 * Master BU data refresh script.
 *
 * Runs all data-collection steps in the correct order, with change detection
 * at every stage. Prints a full report of what changed and which programs
 * are affected.
 *
 * Steps (all run unless --skip-* flags are used):
 *   1. SNAPSHOT  — capture current DB state for diffing
 *   2. COURSES   — scrape BU Bulletin for all (or specified) schools
 *   3. LAB TAG   — re-apply hasLab from official CAS list + SCI2 hub area
 *   4. PROGRAMS  — check every program's required courses against new data
 *   5. REPORT    — print full change report; optionally write JSON to file
 *
 * Usage:
 *   npx tsx scripts/refresh.ts                            # full refresh
 *   npx tsx scripts/refresh.ts --schools cas eng          # only CAS + ENG
 *   npx tsx scripts/refresh.ts --skip-courses             # labs + report only
 *   npx tsx scripts/refresh.ts --report-file report.json  # save JSON report
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import { scrapeAllCourses } from "../src/lib/scraper/orchestrator";
import { fetchWithRetry } from "../src/lib/scraper/fetcher";
import { parseDetailPage } from "../src/lib/scraper/detail-parser";
import { updateScrapeLog } from "../src/lib/scraper/scrape-log";
import { isCasLabCourse } from "../src/lib/constants";

const prisma = new PrismaClient();

// ── Types ──────────────────────────────────────────────────────────────────────

interface CourseSnapshot {
  id: number;
  code: string;
  title: string;
  credits: number;
  department: string;
  description: string;
  prerequisites: string;
  hasLab: boolean;
  hubCodes: string[]; // sorted
}

interface ChangeReport {
  generatedAt: string;
  schoolsScraped: string[];
  courses: {
    added: { code: string; title: string; credits: number; hubCodes: string[] }[];
    removed: { code: string; title: string }[];
    creditsChanged: { code: string; title: string; before: number; after: number }[];
    prereqsChanged: { code: string; title: string; before: string; after: string }[];
    hubAreasChanged: {
      code: string;
      title: string;
      added: string[];
      removed: string[];
    }[];
    labStatusChanged: {
      code: string;
      title: string;
      before: boolean;
      after: boolean;
    }[];
  };
  programs: {
    orphanedRequirements: { program: string; missingCourses: string[] }[];
    affectedByChanges: {
      program: string;
      changedCourses: { code: string; changeType: string }[];
    }[];
  };
  summary: {
    coursesAdded: number;
    coursesRemoved: number;
    coursesModified: number;
    labsTagged: number;
    programsWithIssues: number;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const schools: string[] = [];
  let skipCourses = false;
  let reportFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skip-courses") { skipCourses = true; continue; }
    if (args[i] === "--report-file" && args[i + 1]) { reportFile = args[++i]; continue; }
    if (args[i] === "--schools") {
      i++;
      while (i < args.length && !args[i].startsWith("--")) schools.push(args[i++]);
      i--;
      continue;
    }
  }
  return { schools, skipCourses, reportFile };
}

function header(title: string) {
  const line = "═".repeat(66);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(line);
}

function bullet(symbol: string, text: string) {
  console.log(`  ${symbol} ${text}`);
}

// ── Phase 0: Snapshot ──────────────────────────────────────────────────────────

async function takeSnapshot(): Promise<Map<string, CourseSnapshot>> {
  const courses = await prisma.course.findMany({
    include: { hubAreas: { include: { hubArea: true } } },
  });

  const snap = new Map<string, CourseSnapshot>();
  for (const c of courses) {
    snap.set(c.code, {
      id: c.id,
      code: c.code,
      title: c.title,
      credits: c.credits,
      department: c.department,
      description: c.description,
      prerequisites: c.prerequisites,
      hasLab: c.hasLab,
      hubCodes: c.hubAreas.map((h) => h.hubArea.code).sort(),
    });
  }
  return snap;
}

// ── Phase 2: Lab tagging ───────────────────────────────────────────────────────

async function tagLabCourses(): Promise<number> {
  const sci2 = await prisma.hubArea.findFirst({ where: { code: "SCI2" } });

  const courses = await prisma.course.findMany({
    include: sci2
      ? { hubAreas: { where: { hubAreaId: sci2.id } } }
      : { hubAreas: false },
  });

  let tagged = 0;
  for (const course of courses) {
    const hasSci2 = sci2
      ? (course.hubAreas as { hubAreaId: number }[]).some((h) => h.hubAreaId === sci2.id)
      : false;
    const isLab =
      isCasLabCourse(course.code) ||
      hasSci2 ||
      /\blab(oratory)?\b/i.test(course.title);

    if (isLab && !course.hasLab) {
      await prisma.course.update({ where: { id: course.id }, data: { hasLab: true } });
      tagged++;
    }
    // Unset stale tags: course is no longer on the approved list and has no SCI2
    if (!isLab && course.hasLab) {
      await prisma.course.update({ where: { id: course.id }, data: { hasLab: false } });
    }
  }
  return tagged;
}

// ── Phase 3: Program check ─────────────────────────────────────────────────────

interface ProgramIssues {
  orphanedRequirements: { program: string; missingCourses: string[] }[];
  affectedByChanges: { program: string; changedCourses: { code: string; changeType: string }[] }[];
}

async function checkPrograms(
  before: Map<string, CourseSnapshot>,
  after: Map<string, CourseSnapshot>,
): Promise<ProgramIssues> {
  const programs = await prisma.program.findMany({
    include: { requirements: { include: { courses: true } } },
  });

  const currentCourseCodes = new Set(after.keys());

  const orphanedRequirements: ProgramIssues["orphanedRequirements"] = [];
  const affectedByChanges: ProgramIssues["affectedByChanges"] = [];

  for (const prog of programs) {
    const missing: string[] = [];
    const affected: { code: string; changeType: string }[] = [];

    for (const req of prog.requirements) {
      for (const rc of req.courses) {
        const code = rc.courseCode;

        // Course no longer in DB at all
        if (!currentCourseCodes.has(code)) {
          missing.push(code);
          continue;
        }

        const prev = before.get(code);
        const curr = after.get(code);
        if (!prev || !curr) continue;

        // Credit change
        if (prev.credits !== curr.credits) {
          affected.push({ code, changeType: `credits ${prev.credits}→${curr.credits}` });
        }
        // Prerequisites changed
        if (prev.prerequisites !== curr.prerequisites && curr.prerequisites !== "") {
          affected.push({ code, changeType: "prerequisites updated" });
        }
        // Hub areas changed
        const addedHubs = curr.hubCodes.filter((h) => !prev.hubCodes.includes(h));
        const removedHubs = prev.hubCodes.filter((h) => !curr.hubCodes.includes(h));
        if (addedHubs.length > 0 || removedHubs.length > 0) {
          const parts = [];
          if (addedHubs.length) parts.push(`+hub:${addedHubs.join(",")}`);
          if (removedHubs.length) parts.push(`-hub:${removedHubs.join(",")}`);
          affected.push({ code, changeType: parts.join(" ") });
        }
        // Lab status changed
        if (prev.hasLab !== curr.hasLab) {
          affected.push({ code, changeType: curr.hasLab ? "gained lab" : "lost lab" });
        }
      }
    }

    if (missing.length > 0) {
      orphanedRequirements.push({ program: prog.name, missingCourses: missing });
    }
    if (affected.length > 0) {
      affectedByChanges.push({ program: prog.name, changedCourses: affected });
    }
  }

  return { orphanedRequirements, affectedByChanges };
}

// ── Phase 4: Diff + report ────────────────────────────────────────────────────

function diffSnapshots(
  before: Map<string, CourseSnapshot>,
  after: Map<string, CourseSnapshot>,
) {
  const added: ChangeReport["courses"]["added"] = [];
  const removed: ChangeReport["courses"]["removed"] = [];
  const creditsChanged: ChangeReport["courses"]["creditsChanged"] = [];
  const prereqsChanged: ChangeReport["courses"]["prereqsChanged"] = [];
  const hubAreasChanged: ChangeReport["courses"]["hubAreasChanged"] = [];
  const labStatusChanged: ChangeReport["courses"]["labStatusChanged"] = [];

  // New courses
  for (const [code, snap] of after) {
    if (!before.has(code)) {
      added.push({ code, title: snap.title, credits: snap.credits, hubCodes: snap.hubCodes });
    }
  }

  // Removed + changed courses
  for (const [code, prev] of before) {
    const curr = after.get(code);
    if (!curr) {
      removed.push({ code, title: prev.title });
      continue;
    }
    if (prev.credits !== curr.credits) {
      creditsChanged.push({ code, title: curr.title, before: prev.credits, after: curr.credits });
    }
    if (prev.prerequisites !== curr.prerequisites && curr.prerequisites !== "") {
      prereqsChanged.push({
        code, title: curr.title,
        before: prev.prerequisites || "(none)",
        after: curr.prerequisites,
      });
    }
    const addedHubs   = curr.hubCodes.filter((h) => !prev.hubCodes.includes(h));
    const removedHubs = prev.hubCodes.filter((h) => !curr.hubCodes.includes(h));
    if (addedHubs.length > 0 || removedHubs.length > 0) {
      hubAreasChanged.push({ code, title: curr.title, added: addedHubs, removed: removedHubs });
    }
    if (prev.hasLab !== curr.hasLab) {
      labStatusChanged.push({ code, title: curr.title, before: prev.hasLab, after: curr.hasLab });
    }
  }

  return { added, removed, creditsChanged, prereqsChanged, hubAreasChanged, labStatusChanged };
}

function printReport(report: ChangeReport) {
  header("CHANGE REPORT  —  " + new Date(report.generatedAt).toLocaleString());

  // ── Courses ─────────────────────────────────────────────────────────────────
  header("1. COURSE CHANGES");

  if (report.courses.added.length === 0 &&
      report.courses.removed.length === 0 &&
      report.courses.creditsChanged.length === 0 &&
      report.courses.prereqsChanged.length === 0 &&
      report.courses.hubAreasChanged.length === 0 &&
      report.courses.labStatusChanged.length === 0) {
    bullet("✓", "No course changes detected.");
  }

  if (report.courses.added.length > 0) {
    console.log(`\n  NEW COURSES (${report.courses.added.length})`);
    for (const c of report.courses.added) {
      const hubs = c.hubCodes.length ? `  [${c.hubCodes.join(", ")}]` : "";
      bullet("+", `${c.code.padEnd(22)} ${c.credits}cr  ${c.title.slice(0, 45)}${hubs}`);
    }
  }

  if (report.courses.removed.length > 0) {
    console.log(`\n  REMOVED COURSES (${report.courses.removed.length})`);
    for (const c of report.courses.removed) {
      bullet("✗", `${c.code.padEnd(22)} ${c.title.slice(0, 50)}`);
    }
  }

  if (report.courses.creditsChanged.length > 0) {
    console.log(`\n  CREDIT CHANGES (${report.courses.creditsChanged.length})`);
    for (const c of report.courses.creditsChanged) {
      bullet("~", `${c.code.padEnd(22)} ${c.before}cr → ${c.after}cr  ${c.title.slice(0, 40)}`);
    }
  }

  if (report.courses.prereqsChanged.length > 0) {
    console.log(`\n  PREREQUISITE CHANGES (${report.courses.prereqsChanged.length})`);
    for (const c of report.courses.prereqsChanged) {
      bullet("~", `${c.code.padEnd(22)} ${c.title.slice(0, 40)}`);
      console.log(`       before: ${c.before.slice(0, 80)}`);
      console.log(`       after:  ${c.after.slice(0, 80)}`);
    }
  }

  if (report.courses.hubAreasChanged.length > 0) {
    console.log(`\n  HUB AREA CHANGES (${report.courses.hubAreasChanged.length})`);
    for (const c of report.courses.hubAreasChanged) {
      const parts: string[] = [];
      if (c.added.length)   parts.push(`gained: ${c.added.join(", ")}`);
      if (c.removed.length) parts.push(`lost: ${c.removed.join(", ")}`);
      bullet("~", `${c.code.padEnd(22)} ${c.title.slice(0, 38)}  (${parts.join(" | ")})`);
    }
  }

  if (report.courses.labStatusChanged.length > 0) {
    console.log(`\n  LAB DESIGNATION CHANGES (${report.courses.labStatusChanged.length})`);
    for (const c of report.courses.labStatusChanged) {
      const change = c.after ? "gained lab ★" : "lost lab";
      bullet(c.after ? "★" : "~", `${c.code.padEnd(22)} ${c.title.slice(0, 45)}  → ${change}`);
    }
  }

  // ── Programs ─────────────────────────────────────────────────────────────────
  header("2. PROGRAM IMPACTS");

  if (report.programs.orphanedRequirements.length === 0 &&
      report.programs.affectedByChanges.length === 0) {
    bullet("✓", "All program required courses are intact. No manual review needed.");
  }

  if (report.programs.orphanedRequirements.length > 0) {
    console.log(`\n  ⚠  PROGRAMS WITH MISSING REQUIRED COURSES (${report.programs.orphanedRequirements.length})`);
    console.log("  These programs reference course codes that no longer exist in the DB.");
    console.log("  Action required: check BU's bulletin and update seed-programs.ts.\n");
    for (const p of report.programs.orphanedRequirements) {
      bullet("!", `${p.program}`);
      for (const code of p.missingCourses) {
        console.log(`         missing: ${code}`);
      }
    }
  }

  if (report.programs.affectedByChanges.length > 0) {
    console.log(`\n  PROGRAMS AFFECTED BY COURSE CHANGES (${report.programs.affectedByChanges.length})`);
    for (const p of report.programs.affectedByChanges) {
      bullet("~", p.program);
      for (const c of p.changedCourses) {
        console.log(`         ${c.code.padEnd(22)} ${c.changeType}`);
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  header("SUMMARY");
  const s = report.summary;
  bullet(s.coursesAdded    > 0 ? "+" : "·", `${s.coursesAdded} new course(s)`);
  bullet(s.coursesRemoved  > 0 ? "✗" : "·", `${s.coursesRemoved} removed course(s)`);
  bullet(s.coursesModified > 0 ? "~" : "·", `${s.coursesModified} modified course(s)`);
  bullet(s.labsTagged      > 0 ? "★" : "·", `${s.labsTagged} newly tagged lab course(s)`);
  bullet(s.programsWithIssues > 0 ? "⚠" : "✓",
    `${s.programsWithIssues} program(s) need manual review`);
  console.log();
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { schools, skipCourses, reportFile } = parseArgs();

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║             BU Suggestor — Master Data Refresh               ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  if (schools.length > 0) console.log(`Schools: ${schools.join(", ")}`);
  if (skipCourses)        console.log("Mode: --skip-courses (lab tag + report only)");
  console.log();

  // ── Phase 0: Snapshot ──────────────────────────────────────────────────────
  header("Phase 0 — Snapshot current DB state");
  const before = await takeSnapshot();
  bullet("·", `${before.size} courses in DB before refresh`);

  // ── Phase 1: Course scrape ─────────────────────────────────────────────────
  if (!skipCourses) {
    header("Phase 1 — Scrape BU Bulletin");
    const opts = schools.length > 0 ? { schools } : {};
    await scrapeAllCourses(prisma, opts);
    await updateScrapeLog({ coursesLastScraped: new Date().toISOString() });
  } else {
    header("Phase 1 — Course scrape SKIPPED (--skip-courses)");
  }

  // ── Phase 2: Lab tagging ───────────────────────────────────────────────────
  header("Phase 2 — Tag lab courses (official CAS list + SCI2 hub area)");
  const labsTagged = await tagLabCourses();
  bullet("★", `${labsTagged} course(s) newly tagged as hasLab`);

  // ── Phase 3: Post-scrape snapshot + diff ──────────────────────────────────
  header("Phase 3 — Diff: before vs after");
  const after = await takeSnapshot();
  bullet("·", `${after.size} courses in DB after refresh`);

  const diff = diffSnapshots(before, after);

  // ── Phase 4: Program impact check ─────────────────────────────────────────
  header("Phase 4 — Program requirement check");
  const programIssues = await checkPrograms(before, after);

  const modified =
    diff.creditsChanged.length +
    diff.prereqsChanged.length +
    diff.hubAreasChanged.length +
    diff.labStatusChanged.length;

  const report: ChangeReport = {
    generatedAt: new Date().toISOString(),
    schoolsScraped: schools.length > 0 ? schools : ["all"],
    courses: diff,
    programs: programIssues,
    summary: {
      coursesAdded:       diff.added.length,
      coursesRemoved:     diff.removed.length,
      coursesModified:    modified,
      labsTagged,
      programsWithIssues: programIssues.orphanedRequirements.length,
    },
  };

  // ── Phase 5: Print report ──────────────────────────────────────────────────
  printReport(report);

  if (reportFile) {
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf-8");
    console.log(`  Report saved → ${reportFile}\n`);
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error("\nRefresh failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
