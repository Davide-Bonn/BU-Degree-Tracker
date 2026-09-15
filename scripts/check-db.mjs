import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

// Check empty-school CAS courses
const emptySchool = await p.course.findMany({
  where: { code: { startsWith: "CAS" }, school: "" },
  select: { code: true, slug: true, url: true, department: true },
});
console.log("CAS courses with empty school:");
emptySchool.forEach(c => console.log(" ", c.code, "| dept:", c.department, "| url:", c.url));

// CAS CS count
const total = await p.course.count({ where: { code: { startsWith: "CAS CS" } } });
console.log("\nCAS CS courses total:", total);

// Check if any CAS CS courses have empty dept or wrong categorization
const badDept = await p.course.findMany({
  where: { code: { startsWith: "CAS CS" }, department: { not: "CS" } },
  select: { code: true, department: true },
});
console.log("CAS CS with department != 'CS':", badDept.length);
badDept.forEach(c => console.log(" ", c.code, "| dept:", c.department));

// Check professor count
const profCount = await p.professorRating.count();
const reviewCount = await p.professorReview.count();
console.log("\nProfessor ratings:", profCount);
console.log("Professor reviews:", reviewCount);

if (profCount > 0) {
  const sampleProfs = await p.professorRating.findMany({ take: 5, orderBy: { numRatings: "desc" } });
  console.log("Top professors by reviews:");
  sampleProfs.forEach(p => console.log(" ", p.name, "| dept:", p.department, "| rating:", p.avgRating, "| reviews:", p.numRatings, "| id:", p.id));
}

await p.$disconnect();
