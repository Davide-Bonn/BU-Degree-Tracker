import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOverallProgress } from "@/lib/progress";
import { getEffectiveUserId } from "@/lib/user";
import PlannerClient from "./PlannerClient";
import PlannerTour from "./PlannerTour";
import FavouriteScenarios from "./FavouriteScenarios";

export default async function PlannerPage() {
  const userId = await getEffectiveUserId();

  const [trackedCourses, progress, allDbCourses, favouriteScenarios] = await Promise.all([
    // Only load courses the user is actively tracking (any status)
    prisma.course.findMany({
      where: { userProgress: { some: { userId } } },
      include: {
        userProgress: { where: { userId } },
        hubAreas: { include: { hubArea: true } },
        prerequisiteLinks: {
          include: { prerequisite: true },
        },
        schedules: { select: { semester: true, days: true, startTime: true, endTime: true } },
      },
      orderBy: { code: "asc" },
    }),
    getOverallProgress(userId),
    prisma.course.findMany({ select: { code: true, slug: true } }),
    prisma.planScenario.findMany({
      where: { userId, favourited: true },
      select: { id: true, name: true, _count: { select: { courses: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const slugByCode = new Map(allDbCourses.map((c) => [c.code, c.slug]));

  const serialized = trackedCourses.map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    credits: c.credits,
    slug: c.slug,
    status: c.userProgress[0]?.status ?? null,
    semester: c.userProgress[0]?.semester ?? null,
    grade: c.userProgress[0]?.grade ?? null,
    hubAreas: c.hubAreas.map((ha) => ({
      code: ha.hubArea.code,
      name: ha.hubArea.name,
    })),
    prereqs: c.prerequisiteLinks.map((p) => ({
      code: p.prerequisite.code,
      groupId: p.groupId,
      groupType: p.groupType,
    })),
    offeredTerms: [...new Set(c.schedules.map((s) => s.semester.split(" ")[0]))],
    sections: (() => {
      const seen = new Set<string>();
      return c.schedules
        .filter((s) => s.days && s.startTime && s.endTime)
        .map((s) => ({
          term: s.semester.split(" ")[0],
          days: s.days,
          startTime: s.startTime,
          endTime: s.endTime,
        }))
        .filter((s) => {
          const k = `${s.term}|${s.days}|${s.startTime}|${s.endTime}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
    })(),
  }));

  const plannerProgress = {
    totalCreditsEarned: progress.totalCreditsEarned,
    totalCreditsInProgress: progress.totalCreditsInProgress,
    totalCreditsPlanned: progress.totalCreditsPlanned,
    totalCreditsRequired: progress.totalCreditsRequired,
    gpa: progress.gpa,
    hubUnitsFulfilled: progress.hubUnitsFulfilled,
    hubUnitsTotal: progress.hubUnitsTotal,
    hubCapacities: progress.hubCapacities.map((cap) => ({
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
    missingHubAreas: progress.missingHubAreas,
    doubleCountedCodes: progress.doubleCountedCodes,
    degreeType: progress.degreeType,
    inProgressCourses: progress.inProgressCourses,
    programs: progress.programs.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      type: p.type,
      totalCompleted: p.totalCompleted,
      totalRequired: p.totalRequired,
      schoolRequirements: p.schoolRequirements.map((r) => ({
        id: r.id,
        name: r.name,
        satisfied: r.satisfied,
        inProgress: r.inProgress,
        current: r.current,
        target: r.target,
      })),
      groups: p.groups.map((g) => ({
        groupName: g.groupName,
        description: g.description,
        minCourses: g.minCourses,
        completedCount: g.completedCount,
        inProgressCount: g.inProgressCount,
        plannedCount: g.plannedCount,
        courses: g.courses.map((c) => ({
          code: c.code,
          title: c.title,
          isRequired: c.isRequired,
          status: c.status,
          grade: c.grade,
          semester: c.semester,
          slug: slugByCode.get(c.code) ?? null,
        })),
      })),
    })),
  };

  const favouriteScenariosData = favouriteScenarios.map((s) => ({
    id: s.id,
    name: s.name,
    courseCount: s._count.courses,
  }));

  return (
    <div className="p-6 max-w-full mx-auto space-y-4">
      <PlannerTour />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Semester Planner</h1>
        <Link
          href="/plans"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-accent-light text-accent hover:bg-accent hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
          AI Scenarios
        </Link>
      </div>
      <FavouriteScenarios scenarios={favouriteScenariosData} />
      <PlannerClient courses={serialized} progress={plannerProgress} />
    </div>
  );
}
