import { PrismaClient } from "@prisma/client";
import { fetchWithRetry } from "../src/lib/scraper/fetcher";
import { parseDetailPage } from "../src/lib/scraper/detail-parser";
import { isCasLabCourse, CAS_LAB_COURSES } from "../src/lib/constants";

/**
 * Tag courses with hasLab = true based on the official CAS Natural Sciences
 * Laboratory approved list.
 *
 * Source: https://www.bu.edu/academics/cas/programs/natural-sciences-laboratory-requirement/
 *
 * Detection priority:
 *   1. Course code matches the official CAS approved list (isCasLabCourse)
 *   2. Course title contains "lab" or "laboratory"
 *   3. (--fetch mode) BU Bulletin page lists "Scientific Inquiry II" hub area
 *
 * Usage:
 *   npx tsx scripts/tag-lab-courses.ts              # all courses in DB, official list only
 *   npx tsx scripts/tag-lab-courses.ts AS           # only Astronomy dept
 *   npx tsx scripts/tag-lab-courses.ts AS PY BI     # multiple depts
 *   npx tsx scripts/tag-lab-courses.ts --fetch      # all depts + fetch BU pages for unlisted
 *   npx tsx scripts/tag-lab-courses.ts AS --fetch   # Astronomy + fetch
 */

const prisma = new PrismaClient();

const LAB_TITLE_RE = /\blab(oratory)?\b/i;

async function main() {
  const args = process.argv.slice(2);
  const doFetch = args.includes("--fetch");
  const depts   = args.filter((a) => !a.startsWith("--")).map((a) => a.toUpperCase());

  console.log("=== Tag Lab Courses (CAS Official List) ===");
  console.log(`Mode:  ${doFetch ? "official list + live BU Bulletin fetch for unlisted courses" : "official list only"}`);
  if (depts.length > 0) {
    console.log(`Depts: ${depts.join(", ")}`);
  } else {
    const allDepts = Object.keys(CAS_LAB_COURSES).join(", ");
    console.log(`Depts: ALL (official list covers: ${allDepts})`);
  }
  console.log();

  // Load courses filtered by dept if provided
  const courses = await prisma.course.findMany({
    where: depts.length > 0 ? { department: { in: depts } } : {},
    orderBy: { code: "asc" },
  });

  console.log(`Loaded ${courses.length} course(s) from DB.\n`);

  let tagged        = 0;
  let alreadyTagged = 0;
  let notLab        = 0;

  for (const course of courses) {
    let isLab  = false;
    let reason = "";

    // 1. Official CAS approved list
    if (isCasLabCourse(course.code)) {
      isLab  = true;
      reason = "CAS official lab list";
    }

    // 2. Title contains "lab / laboratory"
    if (!isLab && LAB_TITLE_RE.test(course.title)) {
      isLab  = true;
      reason = "title contains 'lab'";
    }

    // 3. Live BU Bulletin fetch (only for courses not already detected)
    if (!isLab && doFetch && course.url) {
      try {
        process.stdout.write(`  Fetching ${course.code.padEnd(18)} `);
        const html   = await fetchWithRetry(course.url);
        const detail = parseDetailPage(html);

        if (detail.hubAreas.includes("Scientific Inquiry II")) {
          isLab  = true;
          reason = "SCI2 hub on BU Bulletin";
        }
        process.stdout.write(isLab ? `→ lab (${reason})\n` : "→ no lab\n");
      } catch (err) {
        process.stdout.write(`→ fetch error: ${err}\n`);
      }
    }

    if (isLab) {
      if (course.hasLab) {
        alreadyTagged++;
      } else {
        await prisma.course.update({
          where: { id: course.id },
          data:  { hasLab: true },
        });
        console.log(`  [TAGGED]  ${course.code.padEnd(22)} ${course.title.slice(0, 50)}  (${reason})`);
        tagged++;
      }
    } else {
      notLab++;
    }
  }

  console.log();
  console.log("Results:");
  console.log(`  Newly tagged:      ${tagged}`);
  console.log(`  Already tagged:    ${alreadyTagged}`);
  console.log(`  Not a lab course:  ${notLab}`);
  console.log(`  Total processed:   ${courses.length}`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error("Script failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
