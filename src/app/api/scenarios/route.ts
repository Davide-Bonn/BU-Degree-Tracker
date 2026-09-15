import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/user";

export async function GET() {
  const userId = await getEffectiveUserId();

  const scenarios = await prisma.planScenario.findMany({
    where: { userId },
    include: {
      courses: {
        include: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              credits: true,
              hubAreas: { include: { hubArea: { select: { code: true, name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt.toISOString(),
    courses: s.courses.map((sc) => ({
      courseId: sc.courseId,
      code: sc.course.code,
      title: sc.course.title,
      credits: sc.course.credits,
      semester: sc.semester,
      pinned: sc.pinned,
      hubAreas: sc.course.hubAreas.map((ha) => ({
        code: ha.hubArea.code,
        name: ha.hubArea.name,
      })),
    })),
  }));

  return NextResponse.json(serialized);
}

export async function POST(request: Request) {
  const userId = await getEffectiveUserId();
  const { name } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const scenario = await prisma.planScenario.create({
    data: { userId, name: name.trim() },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json({
    id: scenario.id,
    name: scenario.name,
    createdAt: scenario.createdAt.toISOString(),
    courses: [],
  });
}
