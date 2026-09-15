/**
 * Backfill script: extracts prerequisite text from the `description` field for
 * courses where `prerequisites` is empty but description still contains the
 * "Undergraduate Prerequisites: ..." prefix (i.e. the detail-parser failed).
 *
 * After fixing the description/prerequisites fields, re-links all prereqs.
 *
 * Usage:
 *   npx tsx scripts/backfill-prereq-from-desc.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parsePrerequisites } from "../src/lib/scraper/prereq-parser";

const prisma = new PrismaClient();

const PREFIX_RE = /^(?:[\w]+\s+)?Prerequisite[s]?:\s*/i;

function extractFromDescription(
  description: string
): { prerequisites: string; description: string } | null {
  const prefixMatch = description.match(PREFIX_RE);
  if (!prefixMatch) return null;

  const afterColon = description.substring(prefixMatch[0].length);
  const sepMatch = afterColon.match(/\s+-\s+|\.\s+(?=[A-Z])/);

  if (sepMatch && sepMatch.index !== undefined) {
    const i = sepMatch.index;
    const isDotSep = afterColon[i] === ".";
    return {
      prerequisites: afterColon.substring(0, i + (isDotSep ? 1 : 0)).trim(),
      description:   afterColon.substring(i + sepMatch[0].length).trim(),
    };
  } else {
    // No description follows — entire text after the colon is the prereq
    return {
      prerequisites: afterColon.replace(/\.\s*$/, "").trim(),
      description:   "",
    };
  }
}

async function main() {
  // ── Phase 1: backfill description/prerequisites fields ─────────────────────
  console.log("Phase 1: scanning courses with empty prerequisites field...");

  const courses = await prisma.course.findMany({
    where: { prerequisites: "" },
    select: { id: true, code: true, description: true },
  });

  const toFix = courses.filter((c) => PREFIX_RE.test(c.description));
  console.log(`  Found ${toFix.length} / ${courses.length} courses to backfill\n`);

  let updated = 0;
  for (const course of toFix) {
    const extracted = extractFromDescription(course.description);
    if (!extracted) continue;
    await prisma.course.update({
      where: { id: course.id },
      data: {
        prerequisites: extracted.prerequisites,
        description:   extracted.description,
      },
    });
    console.log(`  Fixed [${course.code}]  prereq: ${extracted.prerequisites.substring(0, 60)}`);
    updated++;
  }

  console.log(`\n  Updated ${updated} courses.\n`);

  // ── Phase 2: re-link all prerequisites ────────────────────────────────────
  console.log("Phase 2: re-linking prerequisites for all courses...");

  const allCourses = await prisma.course.findMany({
    select: { id: true, code: true, prerequisites: true },
  });
  const courseByCode = new Map(allCourses.map((c) => [c.code, c]));

  let linked = 0;
  let skipped = 0;
  let processed = 0;

  for (const course of allCourses) {
    if (!course.prerequisites) continue;
    const groups = parsePrerequisites(course.prerequisites);
    if (groups.length === 0) continue;
    processed++;

    await prisma.coursePrerequisite.deleteMany({ where: { courseId: course.id } });

    for (const group of groups) {
      for (const prereqCode of group.courses) {
        const prereq = courseByCode.get(prereqCode);
        if (!prereq) { skipped++; continue; }
        try {
          await prisma.coursePrerequisite.create({
            data: {
              courseId:      course.id,
              prerequisiteId: prereq.id,
              groupId:       group.groupId,
              groupType:     group.type,
            },
          });
          linked++;
        } catch {
          // ignore duplicate constraint errors
        }
      }
    }
  }

  console.log(`  Courses with prereq text: ${processed}`);
  console.log(`  Links created: ${linked}`);
  console.log(`  Unresolved codes (not in DB): ${skipped}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
