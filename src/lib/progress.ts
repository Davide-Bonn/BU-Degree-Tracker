import { cache } from "react";
import { prisma } from "./prisma";
import { GRADE_POINTS, HUB_CAPACITIES, computeCreditsRequired, type DegreeType } from "./constants";
import { computeSchoolRequirements, computeProgramSchoolRequirements, type SchoolRequirementStatus } from "./school-requirements";
import fs from "fs";
import path from "path";

interface HubOverride { id: string; hubCode: string; courseName: string; note: string; }
function readHubOverrides(): HubOverride[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "hub-overrides.json"), "utf-8"));
  } catch { return []; }
}

export interface HubAreaProgress {
  code: string;
  name: string;
  unitsRequired: number;
  unitsFulfilled: number;
  contributingCourses: { code: string; title: string; semester: string; grade: string }[];
}

export interface HubCapacityProgress {
  capacity: string;
  areas: HubAreaProgress[];
  unitsFulfilled: number;
  unitsRequired: number;
}

export interface ProgramGroupProgress {
  groupName: string;
  description: string;
  minCourses: number;
  completedCount: number;
  inProgressCount: number;
  plannedCount: number;
  courses: {
    code: string;
    title: string | null;
    slug: string | null;
    isRequired: boolean;
    status: string | null;
    grade: string | null;
    semester: string | null;
  }[];
}

export interface ProgramProgress {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string;
  isActive: boolean;
  groups: ProgramGroupProgress[];
  totalRequired: number;
  totalCompleted: number;
  schoolRequirements: SchoolRequirementStatus[];
}

// Re-export for consumers that import this type from progress.ts
export type { SchoolRequirementStatus };

export interface MissingHubArea {
  code: string;
  name: string;
  capacity: string;
  unitsRequired: number;
  unitsFulfilled: number;
  unitsStillNeeded: number;
  suggestedCourses: { code: string; title: string; credits: number; slug: string }[];
}

export interface OverallProgress {
  totalCreditsEarned: number;
  totalCreditsInProgress: number;
  totalCreditsPlanned: number;
  totalCreditsRequired: number;
  degreeType: DegreeType;
  gpa: number;
  hubUnitsFulfilled: number;
  hubUnitsTotal: number;
  hubCapacities: HubCapacityProgress[];
  missingHubAreas: MissingHubArea[];
  programs: ProgramProgress[];
  schoolRequirements: SchoolRequirementStatus[];
  inProgressCourses: { id: number; code: string; title: string; semester: string; department: string }[];
  doubleCountedCodes: string[];
}

export const getOverallProgress = cache(async function getOverallProgress(userId = ""): Promise<OverallProgress> {
  // Run all independent queries in parallel
  const [userProgress, allHubAreasMeta, allPrograms, allCourses, rawUserPrograms] = await Promise.all([
    // User's course progress with hub areas (needed for hub fulfillment computation)
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: { course: { include: { hubAreas: { include: { hubArea: true } } } } },
    }),
    // Hub area metadata only — no course deep-include (we derive fulfillment from userProgress)
    prisma.hubArea.findMany({ orderBy: { code: "asc" } }),
    // Programs with their requirement structure
    prisma.program.findMany({
      include: {
        requirements: {
          include: { courses: true },
          orderBy: { groupName: "asc" },
        },
      },
    }),
    // Minimal course data for program requirement lookups and elective filtering
    prisma.course.findMany({
      select: { code: true, title: true, credits: true, slug: true, department: true },
    }),
    // Per-user program selections (UserProgram is the source of truth for isActive)
    prisma.userProgram.findMany({ where: { userId }, select: { programId: true } }),
  ]);

  // Build a per-user set of active program IDs.
  // Fall back to the global Program.isActive only when userId is empty (legacy/unauthenticated).
  const userProgramIds: Set<number> | null =
    userId !== "" ? new Set(rawUserPrograms.map((up) => up.programId)) : null;

  const completedProgress = userProgress.filter((p) => p.status === "completed");
  const inProgressProgress = userProgress.filter((p) => p.status === "in-progress");
  const plannedProgress = userProgress.filter((p) => p.status === "planned");

  // Credits
  const totalCreditsEarned = completedProgress.reduce((sum, p) => sum + p.course.credits, 0);
  const totalCreditsInProgress = inProgressProgress.reduce((sum, p) => sum + p.course.credits, 0);
  const totalCreditsPlanned = plannedProgress.reduce((sum, p) => sum + p.course.credits, 0);

  // GPA
  let totalPoints = 0;
  let totalGPACredits = 0;
  for (const p of completedProgress) {
    const points = GRADE_POINTS[p.grade];
    if (points !== undefined) {
      totalPoints += points * p.course.credits;
      totalGPACredits += p.course.credits;
    }
  }
  const gpa = totalGPACredits > 0 ? Math.round((totalPoints / totalGPACredits) * 1000) / 1000 : 0;

  const completedCourseIds = new Set(completedProgress.map((p) => p.courseId));
  const inProgressCourseIds = new Set(inProgressProgress.map((p) => p.courseId));
  const progressByCourseid = new Map(userProgress.map((p) => [p.courseId, p]));

  // Manual hub overrides
  const hubOverrides = readHubOverrides();
  const overridesByCode = new Map<string, HubOverride[]>();
  for (const o of hubOverrides) {
    const list = overridesByCode.get(o.hubCode) ?? [];
    list.push(o);
    overridesByCode.set(o.hubCode, list);
  }

  // Build hub contributions from already-fetched userProgress (no extra query needed)
  const hubContributions = new Map<string, { code: string; title: string; semester: string; grade: string }[]>();
  for (const p of userProgress) {
    if (p.status !== "completed" && p.status !== "in-progress") continue;
    for (const cha of p.course.hubAreas) {
      const areaCode = cha.hubArea.code;
      const list = hubContributions.get(areaCode) ?? [];
      list.push({
        code: p.course.code,
        title: p.course.title,
        semester: p.semester || "",
        grade: p.grade || "",
      });
      hubContributions.set(areaCode, list);
    }
  }

  const hubCapacities: HubCapacityProgress[] = HUB_CAPACITIES.map((capacity) => {
    const areas = allHubAreasMeta
      .filter((a) => a.capacity === capacity)
      .map((area): HubAreaProgress => {
        const contributingCourses = [...(hubContributions.get(area.code) ?? [])];

        // Manual overrides
        for (const ov of overridesByCode.get(area.code) ?? []) {
          contributingCourses.push({ code: ov.courseName, title: ov.note || "Manual entry", semester: "", grade: "" });
        }

        const unitsFulfilled = Math.min(contributingCourses.length, area.unitsRequired);
        return {
          code: area.code,
          name: area.name,
          unitsRequired: area.unitsRequired,
          unitsFulfilled,
          contributingCourses,
        };
      });

    return {
      capacity,
      areas,
      unitsFulfilled: areas.reduce((sum, a) => sum + a.unitsFulfilled, 0),
      unitsRequired: areas.reduce((sum, a) => sum + a.unitsRequired, 0),
    };
  });

  const hubUnitsFulfilled = hubCapacities.reduce((sum, c) => sum + c.unitsFulfilled, 0);
  const hubUnitsTotal = hubCapacities.reduce((sum, c) => sum + c.unitsRequired, 0);

  // Missing hub areas — fetch suggestions in one targeted query (not for every area)
  const missingAreaCodes: string[] = [];
  for (const cap of hubCapacities) {
    for (const area of cap.areas) {
      if (area.unitsFulfilled < area.unitsRequired) missingAreaCodes.push(area.code);
    }
  }

  const suggestedByAreaCode = new Map<string, { code: string; title: string; credits: number; slug: string }[]>();
  if (missingAreaCodes.length > 0) {
    const doneIds = [...completedCourseIds, ...inProgressCourseIds];
    const suggestionLinks = await prisma.courseHubArea.findMany({
      where: {
        hubArea: { code: { in: missingAreaCodes } },
        ...(doneIds.length > 0 ? { courseId: { notIn: doneIds } } : {}),
      },
      include: {
        course: { select: { code: true, title: true, credits: true, slug: true } },
        hubArea: { select: { code: true } },
      },
    });
    for (const link of suggestionLinks) {
      const list = suggestedByAreaCode.get(link.hubArea.code) ?? [];
      if (list.length < 6) {
        list.push({
          code: link.course.code,
          title: link.course.title,
          credits: link.course.credits,
          slug: link.course.slug,
        });
        suggestedByAreaCode.set(link.hubArea.code, list);
      }
    }
  }

  const missingHubAreas: MissingHubArea[] = [];
  for (const cap of hubCapacities) {
    for (const area of cap.areas) {
      if (area.unitsFulfilled < area.unitsRequired) {
        missingHubAreas.push({
          code: area.code,
          name: area.name,
          capacity: cap.capacity,
          unitsRequired: area.unitsRequired,
          unitsFulfilled: area.unitsFulfilled,
          unitsStillNeeded: area.unitsRequired - area.unitsFulfilled,
          suggestedCourses: suggestedByAreaCode.get(area.code) ?? [],
        });
      }
    }
  }

  // Build course entries once — used for both per-program and global school requirements
  const courseEntries = [
    ...completedProgress,
    ...inProgressProgress,
    ...plannedProgress,
  ].map((p) => ({
    course: {
      code: p.course.code,
      title: p.course.title,
      department: p.course.department,
      credits: p.course.credits,
      hasLab: p.course.hasLab,
    },
    // Treat planned as in-progress so requirements show yellow rather than unsatisfied
    status: p.status === "completed" ? "completed" : "in-progress",
  })) satisfies { course: { code: string; title: string; department: string; credits: number; hasLab?: boolean }; status: "completed" | "in-progress" }[];

  // Program progress
  const courseByCode = new Map(allCourses.map((c) => [c.code, c]));
  const progressByCode = new Map(userProgress.map((p) => [p.course.code, p]));

  const programs: ProgramProgress[] = allPrograms.map((prog) => {
    const groups: ProgramGroupProgress[] = prog.requirements.map((req) => {
      let courses: ProgramGroupProgress["courses"];

      if (req.courses.length === 0) {
        // Dynamic electives: any 300/400/500-level courses in the program's
        // primary department that are not consumed by another group.
        //
        // Special rule: courses listed in a non-required (pick-N) group
        // (e.g. Group B) are only "consumed" up to that group's minCourses.
        // Surplus completed/in-progress courses spill into Group D.
        // Example: Group B needs 2, student has all 3 → the extra one counts here.

        // Build set of codes truly consumed by other groups
        const consumedCodes = new Set<string>();
        for (const other of prog.requirements) {
          if (other.id === req.id || other.courses.length === 0) continue;

          const allRequired = other.courses.filter((c) => c.isRequired);
          const allElective = other.courses.filter((c) => !c.isRequired);

          // Required courses are always consumed
          for (const c of allRequired) consumedCodes.add(c.courseCode);

          // For elective (pick-N) slots: only consume up to minCourses minus required count
          const electiveSlotsNeeded = Math.max(0, other.minCourses - allRequired.length);
          // Prioritise completed/in-progress courses as consumed; rest spill over
          const sortedElectives = [...allElective].sort((a, b) => {
            const pa = progressByCode.get(a.courseCode);
            const pb = progressByCode.get(b.courseCode);
            const sa = pa?.status === "completed" ? 0 : pa?.status === "in-progress" ? 1 : 2;
            const sb = pb?.status === "completed" ? 0 : pb?.status === "in-progress" ? 1 : 2;
            return sa - sb;
          });
          let consumed = 0;
          for (const c of sortedElectives) {
            if (consumed >= electiveSlotsNeeded) break;
            consumedCodes.add(c.courseCode);
            consumed++;
          }
        }

        // All course codes across other groups (for department inference)
        const allOtherCodes = prog.requirements
          .filter((r) => r.id !== req.id)
          .flatMap((r) => r.courses.map((c) => c.courseCode));

        // Infer primary department from courses seeded in the other groups
        const deptCounts = new Map<string, number>();
        for (const code of allOtherCodes) {
          const c = courseByCode.get(code);
          if (c) deptCounts.set(c.department, (deptCounts.get(c.department) ?? 0) + 1);
        }
        const primaryDept = [...deptCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "CS";

        courses = allCourses
          .filter((c) => {
            if (c.department !== primaryDept) return false;
            const num = parseInt(c.code.replace(/\D/g, ""), 10);
            if (Number.isNaN(num)) return false;
            return num >= 300 && !consumedCodes.has(c.code);
          })
          .map((c) => {
            const p = progressByCode.get(c.code);
            return {
              code: c.code,
              title: c.title,
              slug: c.slug,
              isRequired: false,
              status: p?.status ?? null,
              grade: p?.grade ?? null,
              semester: p?.semester ?? null,
            };
          });
      } else {
        courses = req.courses.map((rc) => {
          const course = courseByCode.get(rc.courseCode);
          const p = progressByCode.get(rc.courseCode);
          return {
            code: rc.courseCode,
            title: course?.title ?? null,
            slug: course?.slug ?? null,
            isRequired: rc.isRequired,
            status: p?.status ?? null,
            grade: p?.grade ?? null,
            semester: p?.semester ?? null,
          };
        });
      }

      const completedCount = courses.filter((c) => c.status === "completed").length;
      const inProgressCount = courses.filter((c) => c.status === "in-progress").length;
      const plannedCount = courses.filter((c) => c.status === "planned").length;

      return {
        groupName: req.groupName,
        description: req.description,
        minCourses: req.minCourses,
        completedCount,
        inProgressCount,
        plannedCount,
        courses,
      };
    });

    const totalRequired = groups.reduce((sum, g) => sum + g.minCourses, 0);
    const totalCompleted = groups.reduce((sum, g) => sum + Math.min(g.completedCount, g.minCourses), 0);

    return {
      id: prog.id,
      code: prog.code,
      name: prog.name,
      type: prog.type,
      description: prog.description,
      isActive: userProgramIds !== null ? userProgramIds.has(prog.id) : prog.isActive,
      groups,
      totalRequired,
      totalCompleted,
      schoolRequirements: computeProgramSchoolRequirements(prog.code, courseEntries),
    };
  });

  // Double-counted codes
  const activePrograms = programs.filter((p) => p.isActive);
  const codePrograms = new Map<string, Set<string>>();
  for (const prog of activePrograms) {
    for (const group of prog.groups) {
      for (const course of group.courses) {
        if (course.status !== null) {
          const entry = codePrograms.get(course.code) ?? new Set<string>();
          entry.add(prog.name);
          codePrograms.set(course.code, entry);
        }
      }
    }
  }
  const doubleCountedCodes = [...codePrograms.entries()]
    .filter(([, progs]) => progs.size >= 2)
    .map(([code]) => code);

  // Compute dynamic credit requirements based on active majors
  const activeMajorsForCredits = programs
    .filter((p) => p.isActive && (p.type === "major" || p.type === "joint-major"))
    .map((p) => ({ code: p.code }));
  const { credits: creditsRequired, degreeType } = computeCreditsRequired(activeMajorsForCredits);

  // School-specific graduation requirements (dynamic based on active programs)
  const activeProgramsForSchool = programs.filter((p) => p.isActive).map((p) => ({ code: p.code, type: p.type }));
  const schoolRequirements = computeSchoolRequirements(
    activeProgramsForSchool,
    courseEntries,
    totalCreditsEarned,
    totalCreditsInProgress,
    gpa,
    creditsRequired,
  );

  const inProgressCourses = inProgressProgress.map((p) => ({
    id: p.course.id,
    code: p.course.code,
    title: p.course.title,
    semester: p.semester,
    department: p.course.department,
  }));

  return {
    totalCreditsEarned,
    totalCreditsInProgress,
    totalCreditsPlanned,
    totalCreditsRequired: creditsRequired,
    degreeType,
    gpa,
    hubUnitsFulfilled,
    hubUnitsTotal,
    hubCapacities,
    missingHubAreas,
    programs,
    schoolRequirements,
    inProgressCourses,
    doubleCountedCodes,
  };
});
