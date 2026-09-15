import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/user";
import { getOverallProgress } from "@/lib/progress";
import PlansClient from "./PlansClient";

export default async function PlansPage() {
  const userId = await getEffectiveUserId();

  // Load all saved scenarios
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
              hubAreas: {
                include: { hubArea: { select: { code: true, name: true } } },
              },
              prerequisiteLinks: {
                select: {
                  prerequisiteId: true,
                  prerequisite: { select: { code: true } },
                },
              },
              schedules: {
                select: { semester: true, days: true, startTime: true, endTime: true },
                where: { days: { not: "" }, startTime: { not: "" }, endTime: { not: "" } },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Load user's existing course progress and overall stats in parallel
  const [existingProgress, overallProgress] = await Promise.all([
    prisma.userCourseProgress.findMany({
      where: { userId, status: { in: ["completed", "in-progress"] } },
      include: {
        course: { select: { id: true, code: true, title: true, credits: true } },
      },
    }),
    getOverallProgress(userId),
  ]);

  const initialScenarios = scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt.toISOString(),
    favourited: s.favourited,
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
      prereqs: sc.course.prerequisiteLinks.map((pl) => ({
        courseId: pl.prerequisiteId,
        code: pl.prerequisite.code,
      })),
      sections: (() => {
        const seen = new Set<string>();
        return sc.course.schedules
          .map((s) => ({
            term: s.semester.split(" ")[0],
            days: s.days,
            startTime: s.startTime,
            endTime: s.endTime,
          }))
          .filter((s) => {
            const k = `${s.term}|${s.days}|${s.startTime}|${s.endTime}`;
            return seen.has(k) ? false : (seen.add(k), true);
          });
      })(),
    })),
  }));

  const existingCourses = existingProgress.map((p) => ({
    courseId: p.courseId,
    code: p.course.code,
    title: p.course.title,
    credits: p.course.credits,
    semester: p.semester || "",
    status: p.status as "completed" | "in-progress",
  }));

  const baseProgress = {
    totalCreditsEarned: overallProgress.totalCreditsEarned,
    totalCreditsInProgress: overallProgress.totalCreditsInProgress,
    totalCreditsRequired: overallProgress.totalCreditsRequired,
    gpa: overallProgress.gpa,
    hubUnitsFulfilled: overallProgress.hubUnitsFulfilled,
    hubUnitsTotal: overallProgress.hubUnitsTotal,
    hubCapacities: overallProgress.hubCapacities.map((cap) => ({
      capacity: cap.capacity,
      unitsFulfilled: cap.unitsFulfilled,
      unitsRequired: cap.unitsRequired,
      areas: cap.areas.map((a) => ({
        code: a.code,
        name: a.name,
        unitsFulfilled: a.unitsFulfilled,
        unitsRequired: a.unitsRequired,
        contributingCourses: a.contributingCourses,
      })),
    })),
    programs: overallProgress.programs.map((p) => ({
      name: p.name,
      isActive: p.isActive,
      type: p.type,
      totalCompleted: p.totalCompleted,
      totalRequired: p.totalRequired,
      groups: p.groups.map((g) => ({
        groupName: g.groupName,
        description: g.description,
        minCourses: g.minCourses,
        completedCount: g.completedCount,
        inProgressCount: g.inProgressCount,
        plannedCount: g.plannedCount,
        courses: g.courses.map((c) => ({ code: c.code, title: c.title, status: c.status, isRequired: c.isRequired })),
      })),
    })),
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-card-border">
        <h1 className="text-2xl font-bold">Degree Scenarios</h1>
        <p className="text-sm text-muted mt-0.5">
          Generate and compare AI-built degree plans. Pin courses you want to keep, then regenerate with new options.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <PlansClient
          initialScenarios={initialScenarios}
          existingCourses={existingCourses}
          baseProgress={baseProgress}
        />
      </div>
    </div>
  );
}
