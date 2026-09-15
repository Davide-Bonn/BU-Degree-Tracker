import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function addHub(courseCode, hubCode) {
  const course = await prisma.course.findUnique({ where: { code: courseCode } });
  if (!course) { console.log(`Course not found: ${courseCode}`); return; }
  const hub = await prisma.hubArea.findUnique({ where: { code: hubCode } });
  if (!hub) { console.log(`Hub not found: ${hubCode}`); return; }
  const existing = await prisma.courseHubArea.findFirst({ where: { courseId: course.id, hubAreaId: hub.id } });
  if (existing) { console.log(`Already tagged: ${courseCode} → ${hubCode}`); return; }
  await prisma.courseHubArea.create({ data: { courseId: course.id, hubAreaId: hub.id } });
  console.log(`Added: ${courseCode} → ${hubCode} (${hub.name})`);
}

async function removeHub(courseCode, hubCode) {
  const course = await prisma.course.findUnique({ where: { code: courseCode } });
  if (!course) { console.log(`Course not found: ${courseCode}`); return; }
  const hub = await prisma.hubArea.findUnique({ where: { code: hubCode } });
  if (!hub) { console.log(`Hub not found: ${hubCode}`); return; }
  const existing = await prisma.courseHubArea.findFirst({ where: { courseId: course.id, hubAreaId: hub.id } });
  if (!existing) { console.log(`Not tagged: ${courseCode} → ${hubCode}`); return; }
  await prisma.courseHubArea.delete({ where: { id: existing.id } });
  console.log(`Removed: ${courseCode} → ${hubCode} (${hub.name})`);
}

// CAS FY 101 → DIV1 (The Individual in Community)
await addHub("CAS FY 101", "DIV1");

// QST SM 131 → CIV1 (Ethical Reasoning)
await addHub("QST SM 131", "CIV1");

// QST SM 131 does NOT satisfy ITK2 (Research and Information Literacy) — remove wrong tag
await removeHub("QST SM 131", "ITK2");

await prisma.$disconnect();
console.log("Done.");
