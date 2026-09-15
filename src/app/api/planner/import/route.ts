import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/user";

interface ImportCourse {
  code: string;
  status: string;
  semester: string;
  grade: string;
}

export async function POST(request: Request) {
  const userId = await getEffectiveUserId();

  const body = await request.json() as { courses: ImportCourse[] };
  const { courses } = body;

  if (!Array.isArray(courses) || courses.length === 0) {
    return NextResponse.json({ error: "courses array required" }, { status: 400 });
  }

  const validStatuses = ["completed", "in-progress", "planned"];
  const validCourses = courses.filter((c) => c.code && validStatuses.includes(c.status));

  const codes = validCourses.map((c) => c.code);
  const dbCourses = await prisma.course.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const idByCode = new Map(dbCourses.map((c) => [c.code, c.id]));

  let imported = 0;
  let skipped = 0;

  for (const item of validCourses) {
    const courseId = idByCode.get(item.code);
    if (!courseId) { skipped++; continue; }

    await prisma.userCourseProgress.upsert({
      where: { courseId_userId: { courseId, userId } },
      update: {
        status: item.status,
        semester: item.semester || "",
        grade: item.grade || "",
      },
      create: {
        userId,
        courseId,
        status: item.status,
        semester: item.semester || "",
        grade: item.grade || "",
      },
    });
    imported++;
  }

  return NextResponse.json({ imported, skipped });
}
