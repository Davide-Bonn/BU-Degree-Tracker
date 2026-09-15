import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOverallProgress } from "@/lib/progress";
import { getEffectiveUserId } from "@/lib/user";
import { GRADE_POINTS } from "@/lib/constants";

async function getUserId(): Promise<string> {
  return getEffectiveUserId();
}

export async function GET() {
  const userId = await getUserId();
  const progress = await getOverallProgress(userId);
  return NextResponse.json(progress);
}

export async function POST(request: Request) {
  const userId = await getUserId();
  const body = await request.json();
  const { courseId, status, semester, grade } = body;

  if (!courseId || !status) {
    return NextResponse.json({ error: "courseId and status required" }, { status: 400 });
  }

  if (!["completed", "in-progress", "planned"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const VALID_GRADES = new Set([...Object.keys(GRADE_POINTS), "P"]);
  if (grade && !VALID_GRADES.has(grade)) {
    return NextResponse.json({ error: "Invalid grade" }, { status: 400 });
  }

  const progress = await prisma.userCourseProgress.upsert({
    where: { courseId_userId: { courseId: Number(courseId), userId } },
    update: {
      status,
      semester: semester || "",
      grade: grade || "",
    },
    create: {
      userId,
      courseId: Number(courseId),
      status,
      semester: semester || "",
      grade: grade || "",
    },
  });

  return NextResponse.json(progress);
}

export async function DELETE(request: Request) {
  const userId = await getUserId();
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");

  if (!courseId) {
    return NextResponse.json({ error: "courseId required" }, { status: 400 });
  }

  await prisma.userCourseProgress.deleteMany({
    where: { courseId: Number(courseId), userId },
  });

  return NextResponse.json({ success: true });
}
