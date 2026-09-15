// Fix courses where school/career is empty because the URL was blank (seed data).
// Derives school from the course code prefix (CAS, GRS, MET, etc.).
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const CODE_PREFIX_TO_SCHOOL = {
  CAS: "College of Arts & Sciences",
  CDS: "Faculty of Computing & Data Sciences",
  COM: "College of Communication",
  ENG: "College of Engineering",
  QST: "Questrom School of Business",
  SAR: "Sargent College",
  SHA: "School of Hospitality Administration",
  SPH: "School of Public Health",
  SSW: "School of Social Work",
  STH: "School of Theology",
  MET: "Metropolitan College",
  CFA: "College of Fine Arts",
  CGS: "College of General Studies",
  WED: "Wheelock College of Education & Human Development",
  LAW: "School of Law",
  GRS: "Graduate School of Arts & Sciences",
};

const GRADUATE_SCHOOLS = new Set(["GRS", "SSW", "STH", "SPH", "LAW"]);

const broken = await p.course.findMany({
  where: { school: "" },
  select: { id: true, code: true, url: true },
});

console.log(`Found ${broken.length} courses with empty school field`);

for (const c of broken) {
  const prefix = c.code.split(/\s+/)[0]?.toUpperCase() ?? "";
  const school = CODE_PREFIX_TO_SCHOOL[prefix] ?? "";
  const career = GRADUATE_SCHOOLS.has(prefix) ? (prefix === "LAW" ? "Law" : "Graduate") : "Undergraduate";

  if (!school) {
    console.log(`  Skipping ${c.code} — unknown prefix "${prefix}"`);
    continue;
  }

  await p.course.update({ where: { id: c.id }, data: { school, career } });
  console.log(`  Fixed ${c.code} → school: "${school}", career: "${career}"`);
}

console.log("Done.");
await p.$disconnect();
