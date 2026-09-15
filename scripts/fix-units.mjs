import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const corrections = [
  // Scientific & Social — each needs 1 course
  { code: "SCI1", unitsRequired: 1 },
  { code: "SCI2", unitsRequired: 1 },
  { code: "SOC1", unitsRequired: 1 },
  { code: "SOC2", unitsRequired: 1 },
  // Quantitative Reasoning — each needs 1 course
  { code: "QR1", unitsRequired: 1 },
  { code: "QR2", unitsRequired: 1 },
  // Diversity — DIV1 and CIV1 need 1 course; DIV2 stays at 2
  { code: "DIV1", unitsRequired: 1 },
  { code: "CIV1", unitsRequired: 1 },
  // Communication — WIC needs 2 courses
  { code: "WIC", unitsRequired: 2 },
];

for (const { code, unitsRequired } of corrections) {
  const area = await prisma.hubArea.findUnique({ where: { code } });
  if (!area) { console.log(`Not found: ${code}`); continue; }
  await prisma.hubArea.update({ where: { code }, data: { unitsRequired } });
  console.log(`${code}: ${area.unitsRequired} → ${unitsRequired}`);
}

await prisma.$disconnect();
console.log("Done.");
