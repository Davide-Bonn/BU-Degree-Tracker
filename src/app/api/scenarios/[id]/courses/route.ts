import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/user";

/** PATCH — toggle pin or move a course to a different semester */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getEffectiveUserId();
  const { id } = await params;
  const scenarioId = parseInt(id, 10);

  const scenario = await prisma.planScenario.findFirst({ where: { id: scenarioId, userId } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json() as { courseId: number; pinned?: boolean; semester?: string };

  const updateData: Record<string, unknown> = {};
  if (body.pinned !== undefined) updateData.pinned = body.pinned;
  if (body.semester !== undefined) updateData.semester = body.semester;

  const updated = await prisma.planScenarioCourse.updateMany({
    where: { scenarioId, courseId: body.courseId },
    data: updateData,
  });

  return NextResponse.json({ updated: updated.count });
}

/** DELETE — remove a course from a scenario */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getEffectiveUserId();
  const { id } = await params;
  const scenarioId = parseInt(id, 10);

  const scenario = await prisma.planScenario.findFirst({ where: { id: scenarioId, userId } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const courseId = parseInt(searchParams.get("courseId") ?? "", 10);
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  await prisma.planScenarioCourse.deleteMany({ where: { scenarioId, courseId } });
  return NextResponse.json({ success: true });
}
