/**
 * Export all SQLite data to data/sqlite-export.json
 * Run BEFORE changing the schema to PostgreSQL.
 * npx tsx scripts/export-sqlite.ts
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Exporting SQLite data…");

  const data = {
    hubAreas:               await prisma.hubArea.findMany(),
    courses:                await prisma.course.findMany(),
    courseHubAreas:         await prisma.courseHubArea.findMany(),
    courseSchedules:        await prisma.courseSchedule.findMany(),
    coursePrerequisites:    await prisma.coursePrerequisite.findMany(),
    programs:               await prisma.program.findMany(),
    programRequirements:    await prisma.programRequirement.findMany(),
    programRequirementCourses: await prisma.programRequirementCourse.findMany(),
    professorRatings:       await prisma.professorRating.findMany(),
    professorReviews:       await prisma.professorReview.findMany(),
    userProfiles:           await prisma.userProfile.findMany(),
    userCourseProgress:     await prisma.userCourseProgress.findMany(),
    userPrograms:           await prisma.userProgram.findMany(),
  };

  const outFile = path.join(process.cwd(), "data", "sqlite-export.json");
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2));

  const counts = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, (v as unknown[]).length])
  );
  console.log("Exported counts:", counts);
  console.log("Saved to", outFile);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
