import { PrismaClient } from "@prisma/client";
import { parsePrerequisites } from "../src/lib/scraper/prereq-parser";

const prisma = new PrismaClient();

async function main() {
  const allCourses = await prisma.course.findMany({
    select: { id: true, code: true, prerequisites: true },
  });
  const courseByCode = new Map(allCourses.map((c) => [c.code, c]));

  let linked = 0;
  let skipped = 0;
  let coursesWithPrereqs = 0;

  for (const course of allCourses) {
    if (!course.prerequisites) continue;
    const groups = parsePrerequisites(course.prerequisites);
    if (groups.length === 0) continue;
    coursesWithPrereqs++;

    await prisma.coursePrerequisite.deleteMany({ where: { courseId: course.id } });

    for (const group of groups) {
      for (const prereqCode of group.courses) {
        const prereq = courseByCode.get(prereqCode);
        if (!prereq) { skipped++; continue; }
        try {
          await prisma.coursePrerequisite.create({
            data: {
              courseId: course.id,
              prerequisiteId: prereq.id,
              groupId: group.groupId,
              groupType: group.type,
            },
          });
          linked++;
        } catch {
          // duplicate
        }
      }
    }
  }

  console.log("Courses with prereq text:", coursesWithPrereqs);
  console.log("Links created:", linked);
  console.log("Unresolved codes (not in DB):", skipped);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
