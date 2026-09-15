/**
 * Import all data from data/sqlite-export.json into Supabase PostgreSQL via REST API.
 *
 * Prerequisites:
 *   1. Paste data/schema.sql into the Supabase SQL Editor and run it.
 *   2. Run this script: npx tsx scripts/import-to-supabase.ts
 *
 * Uses the service role key to bypass RLS.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BATCH = 500;

async function upsertBatch(table: string, rows: object[], onConflict: string) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      console.error(`Error upserting ${table} at offset ${i}:`, error.message);
      throw error;
    }
    process.stdout.write(`\r  ${table}: ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
  }
  console.log();
}

async function main() {
  const exportPath = path.join(process.cwd(), "data", "sqlite-export.json");
  const data = JSON.parse(fs.readFileSync(exportPath, "utf8"));

  console.log("Starting import to Supabase…\n");

  // 1. HubArea
  console.log("HubArea…");
  await upsertBatch("HubArea", data.hubAreas, "id");

  // 2. Course
  console.log("Course…");
  await upsertBatch("Course", data.courses, "id");

  // 3. CourseHubArea
  console.log("CourseHubArea…");
  await upsertBatch("CourseHubArea", data.courseHubAreas, "id");

  // 4. CourseSchedule
  console.log("CourseSchedule…");
  await upsertBatch("CourseSchedule", data.courseSchedules, "id");

  // 5. CoursePrerequisite
  console.log("CoursePrerequisite…");
  await upsertBatch("CoursePrerequisite", data.coursePrerequisites, "id");

  // 6. Program
  console.log("Program…");
  await upsertBatch("Program", data.programs, "id");

  // 7. ProgramRequirement
  console.log("ProgramRequirement…");
  await upsertBatch("ProgramRequirement", data.programRequirements, "id");

  // 8. ProgramRequirementCourse
  console.log("ProgramRequirementCourse…");
  await upsertBatch("ProgramRequirementCourse", data.programRequirementCourses, "id");

  // 9. ProfessorRating
  console.log("ProfessorRating…");
  await upsertBatch("ProfessorRating", data.professorRatings, "id");

  // 10. ProfessorReview
  console.log("ProfessorReview…");
  await upsertBatch("ProfessorReview", data.professorReviews, "id");

  // 11. UserProfile
  console.log("UserProfile…");
  await upsertBatch("UserProfile", data.userProfiles, "id");

  // 12. UserCourseProgress
  console.log("UserCourseProgress…");
  await upsertBatch("UserCourseProgress", data.userCourseProgress, "id");

  // 13. UserProgram
  console.log("UserProgram…");
  await upsertBatch("UserProgram", data.userPrograms, "id");

  // 14. Reset all sequences so future autoincrement IDs don't collide
  console.log("\nResetting sequences…");
  const tables = [
    "Course", "HubArea", "CourseHubArea", "CourseSchedule", "CoursePrerequisite",
    "Program", "ProgramRequirement", "ProgramRequirementCourse",
    "ProfessorRating", "ProfessorReview", "UserCourseProgress", "UserProgram",
    "HubAreaOverride",
  ];
  const seqSql = tables
    .map(t => `SELECT setval('"${t}_id_seq"', COALESCE((SELECT MAX(id) FROM "${t}"), 1));`)
    .join("\n");

  const { error: seqErr } = await supabase.rpc("exec_sql", { sql: seqSql }).single();
  if (seqErr) {
    // exec_sql RPC may not exist — print the SQL for manual run instead
    console.log("Could not reset sequences automatically. Run this in the SQL Editor:");
    console.log(seqSql);
  } else {
    console.log("Sequences reset.");
  }

  console.log("\nImport complete!");
}

main().catch(e => { console.error(e); process.exit(1); });
