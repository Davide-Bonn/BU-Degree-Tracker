import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/user";
import GradeEditor from "./GradeEditor";

export default async function GradesPage() {
  const userId = await getEffectiveUserId();

  const records = await prisma.userCourseProgress.findMany({
    where: { userId, status: "completed" },
    include: {
      course: { select: { id: true, code: true, title: true, credits: true } },
    },
  });

  const courses = records.map((p) => ({
    courseId: p.courseId,
    code: p.course.code,
    title: p.course.title,
    credits: p.course.credits,
    semester: p.semester ?? "",
    grade: p.grade ?? "",
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Grades</h1>
      <GradeEditor courses={courses} />
    </div>
  );
}
