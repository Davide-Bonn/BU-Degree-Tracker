// Set professorId on existing ProfessorReview rows using the professorName string.
// Safe to run because before this schema change, name was @unique so the lookup is 1:1.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const reviews = await p.professorReview.findMany({
  where: { professorId: 0 },
  select: { id: true, professorName: true },
});
console.log(`Found ${reviews.length} reviews with professorId = 0`);

// Build a map of name → id from ProfessorRating
const ratings = await p.professorRating.findMany({ select: { id: true, name: true } });
const nameToId = new Map(ratings.map((r) => [r.name, r.id]));

let updated = 0;
let missing = 0;
for (const r of reviews) {
  const profId = nameToId.get(r.professorName);
  if (!profId) { missing++; continue; }
  await p.professorReview.update({ where: { id: r.id }, data: { professorId: profId } });
  updated++;
  if (updated % 200 === 0) process.stdout.write(`  ${updated}/${reviews.length}\r`);
}

console.log(`\nUpdated: ${updated}  |  No matching professor: ${missing}`);
await p.$disconnect();
