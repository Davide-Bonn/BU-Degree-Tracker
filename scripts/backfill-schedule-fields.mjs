// One-time backfill: derive days/startTime/endTime/instructionMode/instructorLastName
// from existing CourseSchedule records, and school/career from Course URL slugs.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SCHOOLS = [
  { slug: "cas",      label: "College of Arts & Sciences" },
  { slug: "cds",      label: "Faculty of Computing & Data Sciences" },
  { slug: "com",      label: "College of Communication" },
  { slug: "eng",      label: "College of Engineering" },
  { slug: "qst",      label: "Questrom School of Business" },
  { slug: "sar",      label: "Sargent College" },
  { slug: "sha",      label: "School of Hospitality Administration" },
  { slug: "sph",      label: "School of Public Health" },
  { slug: "ssw",      label: "School of Social Work" },
  { slug: "sth",      label: "School of Theology" },
  { slug: "met",      label: "Metropolitan College" },
  { slug: "cfa",      label: "College of Fine Arts" },
  { slug: "cgs",      label: "College of General Studies" },
  { slug: "wheelock", label: "Wheelock College of Education & Human Development" },
  { slug: "law",      label: "School of Law" },
  { slug: "grs",      label: "Graduate School of Arts & Sciences" },
];

const SCHOOL_TO_CAREER = {
  grs: "Graduate", ssw: "Graduate", sth: "Graduate", sph: "Graduate", law: "Law",
};

function parseScheduleDays(schedule) {
  const match = schedule.match(/^([MmTtWwRrFfSsUu]+)\s+/);
  if (!match) return "";
  const raw = match[1].toUpperCase();
  const days = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "S" && raw[i + 1] === "U") { days.push("Su"); i += 2; }
    else { days.push(raw[i]); i++; }
  }
  return days.join(",");
}

function toHHMM(t) {
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return "";
  let h = parseInt(m[1]);
  const min = m[2];
  const p = m[3].toLowerCase();
  if (p === "pm" && h !== 12) h += 12;
  if (p === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function parseScheduleTime(schedule) {
  const m = schedule.match(/\d{1,2}:\d{2}\s*(?:am|pm)-\d{1,2}:\d{2}\s*(?:am|pm)/i);
  if (!m) return { startTime: "", endTime: "" };
  const parts = m[0].split("-");
  return { startTime: toHHMM(parts[0].trim()), endTime: toHHMM(parts[1].trim()) };
}

function deriveInstructionMode(location) {
  if (!location || location === "NO ROOM" || location === "ARR" || location === "TBA") return "";
  const l = location.toLowerCase();
  if (l.includes("online") || l.includes("remote")) return "Online";
  return "In Person";
}

async function main() {
  // --- Backfill CourseSchedule ---
  console.log("Backfilling CourseSchedule records...");
  const schedules = await prisma.courseSchedule.findMany();
  console.log(`  Found ${schedules.length} schedule records`);

  let schedUpdated = 0;
  for (const s of schedules) {
    const days = parseScheduleDays(s.schedule);
    const { startTime, endTime } = parseScheduleTime(s.schedule);
    const instructionMode = deriveInstructionMode(s.location);
    const instructorLastName = s.instructor; // BU Bulletin only shows last name

    await prisma.courseSchedule.update({
      where: { id: s.id },
      data: { days, startTime, endTime, instructionMode, instructorLastName },
    });
    schedUpdated++;
    if (schedUpdated % 100 === 0) {
      process.stdout.write(`  ${schedUpdated}/${schedules.length} schedules updated\r`);
    }
  }
  console.log(`\n  Done: ${schedUpdated} schedule records updated.`);

  // --- Backfill Course school + career ---
  console.log("\nBackfilling Course school and career fields...");
  const courses = await prisma.course.findMany({ select: { id: true, url: true } });
  console.log(`  Found ${courses.length} course records`);

  let courseUpdated = 0;
  for (const c of courses) {
    const slugMatch = c.url.match(/\/academics\/(\w+)\/courses\//);
    const schoolSlug = slugMatch?.[1] ?? "";
    const found = SCHOOLS.find((s) => s.slug === schoolSlug);
    const schoolLabel = found?.label ?? "";
    const career = SCHOOL_TO_CAREER[schoolSlug] ?? "Undergraduate";

    await prisma.course.update({
      where: { id: c.id },
      data: { school: schoolLabel, career },
    });
    courseUpdated++;
    if (courseUpdated % 100 === 0) {
      process.stdout.write(`  ${courseUpdated}/${courses.length} courses updated\r`);
    }
  }
  console.log(`\n  Done: ${courseUpdated} course records updated.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
