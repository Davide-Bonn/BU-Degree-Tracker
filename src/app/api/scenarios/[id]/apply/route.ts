/**
 * POST /api/scenarios/[id]/apply
 *
 * Copies the scenario's course-semester assignments into the user's main
 * UserCourseProgress as "planned" status. Courses already completed or
 * in-progress are left untouched.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/user";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getEffectiveUserId();
  const { id } = await params;
  const scenarioId = parseInt(id, 10);

  let scenario = await prisma.planScenario.findFirst({
    where: { id: scenarioId, userId },
    include: { courses: true },
  });

  // Handle guest → authenticated transition: if the scenario exists but belongs
  // to a different userId (e.g., a guest session), reassign it to the current user.
  if (!scenario) {
    const orphaned = await prisma.planScenario.findFirst({
      where: { id: scenarioId },
      include: { courses: true },
    });
    if (!orphaned) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.planScenario.update({
      where: { id: scenarioId },
      data: { userId },
    });
    scenario = { ...orphaned, userId };
  }

  // Merge mode: only add courses not already in the planner (any status).
  // This preserves the user's existing planner — completed, in-progress,
  // and manually planned courses are never touched.
  const existingProgress = await prisma.userCourseProgress.findMany({
    where: { userId, courseId: { in: scenario.courses.map((c) => c.courseId) } },
    select: { courseId: true },
  });
  const existingIds = new Set(existingProgress.map((p) => p.courseId));

  let applied = 0;
  for (const sc of scenario.courses) {
    if (existingIds.has(sc.courseId)) continue;
    await prisma.userCourseProgress.create({
      data: { userId, courseId: sc.courseId, status: "planned", semester: sc.semester },
    });
    applied++;
  }

  return NextResponse.json({ applied });
}
