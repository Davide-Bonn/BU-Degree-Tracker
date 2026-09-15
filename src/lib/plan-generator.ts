/**
 * Plan Generator — builds 10 distinct plans satisfying all degree requirements.
 *
 * Architecture:
 *   1. `fetchPlanContext` — one shared set of DB queries for all variants
 *   2. `runVariant`       — pure algorithm (no I/O) producing one plan
 *   3. `generateAllPlans` — orchestrates both; called from the API route
 *
 * Constraints respected:
 *   ✓ Max courses per semester (user-chosen; default 4 — 5 is "heavy")
 *   ✓ Max major courses per semester (user-chosen; default 2)
 *   ✓ Prerequisites placed in earlier semesters than dependents
 *   ✓ Historical term offerings (Fall/Spring/Summer from CourseSchedule)
 *   ✓ Pinned courses fixed in their semester
 *   ✓ Completed / in-progress courses excluded from planning
 *   ✓ Hub area requirements (no global take bug — all areas get candidates)
 *   ✓ Major + minor group minimums — all required courses included
 *   ✓ Credit target tracked; filler candidates added when hub+major fall short
 *   ✓ Early-finish detection: last-assigned semester returned for UI suggestion
 */

import { prisma } from "./prisma";
import { compareSemesters, getCurrentSemester } from "./semester-utils";
import { computeCreditsRequired } from "./constants";
import {
  type CourseEntry,
  type SchoolReqSearchCriterion,
  courseNum,
  getUnsatisfiedSchoolReqCriteria,
  computeProgramSchoolRequirements,
} from "./school-requirements";

// ── Public types ───────────────────────────────────────────────────────────────

export interface GeneratedAssignment {
  courseId: number;
  code: string;
  title: string;
  credits: number;
  semester: string;
  pinned: boolean;
}

export interface PlanValidation {
  valid: boolean;
  missing: string[];
}

export interface GeneratePlanResult {
  variantIndex: number;
  name: string;
  assignments: GeneratedAssignment[];
  /** Last semester in this plan — may be earlier than the user's target graduation. */
  earliestFinish: string | null;
  /** Post-generation validation results */
  validation: PlanValidation;
}

export interface GenerateOptions {
  /** Max courses per semester cap for this generate run. Default: 4. */
  maxCoursesPerSem?: 3 | 4 | 5;
  /**
   * Max major-program courses per semester.
   * Only counts courses from "major" / "joint-major" programs, not minors.
   * Default: 2.  Use 0 to disable the limit.
   */
  majorCoursesPerSem?: 0 | 2 | 3;
}

// ── Variant configs — 10 distinct strategies ──────────────────────────────────
// maxLoad = per-variant ceiling; capped further by user's maxCoursesPerSem.
// "Spread Out" uses 3 so it always produces a genuinely lighter schedule.

interface VariantConfig {
  name: string;
  hubW: number;
  majW: number;
  elecW: number;
  hRot: 0 | 1 | 2;
  mRot: 0 | 1 | 2;
  maxLoad: number;
}

const VARIANTS: VariantConfig[] = [
  { name: "Hub Priority",    hubW: 16, majW:  9, elecW:  5, hRot: 0, mRot: 0, maxLoad: 5 },
  { name: "Major Priority",  hubW:  8, majW: 20, elecW:  9, hRot: 0, mRot: 0, maxLoad: 5 },
  { name: "Balanced A",      hubW: 12, majW: 12, elecW:  6, hRot: 0, mRot: 0, maxLoad: 5 },
  { name: "Balanced B",      hubW: 12, majW: 12, elecW:  6, hRot: 1, mRot: 1, maxLoad: 5 },
  { name: "Balanced C",      hubW: 12, majW: 12, elecW:  6, hRot: 2, mRot: 2, maxLoad: 5 },
  { name: "Hub Focus A",     hubW: 18, majW:  7, elecW:  4, hRot: 1, mRot: 0, maxLoad: 5 },
  { name: "Hub Focus B",     hubW: 18, majW:  7, elecW:  4, hRot: 2, mRot: 0, maxLoad: 5 },
  { name: "Major Alt A",     hubW:  7, majW: 18, elecW: 10, hRot: 0, mRot: 1, maxLoad: 5 },
  { name: "Major Alt B",     hubW:  7, majW: 18, elecW: 10, hRot: 1, mRot: 2, maxLoad: 5 },
  { name: "Spread Out",      hubW: 10, majW: 13, elecW:  6, hRot: 2, mRot: 2, maxLoad: 3 },
];

// ── Semester ordering ─────────────────────────────────────────────────────────

function semOrd(s: string): number {
  const [term, yearStr] = s.trim().split(" ");
  const year = parseInt(yearStr) || 0;
  if (term === "Fall")   return year * 3;
  if (term === "Spring") return (year - 1) * 3 + 1;
  if (term === "Summer") return (year - 1) * 3 + 2;
  return year * 3;
}

function buildAvailableSems(from: string, to: string): string[] {
  const fromOrd  = semOrd(from);
  const toOrd    = semOrd(to);
  const fromYear = parseInt(from.split(" ")[1]) || new Date().getFullYear();
  const toYear   = parseInt(to.split(" ")[1])   || fromYear + 4;

  const result: string[] = [];
  for (let y = fromYear; y <= toYear + 1; y++) {
    for (const sem of [`Fall ${y}`, `Spring ${y + 1}`, `Summer ${y + 1}`]) {
      const ord = semOrd(sem);
      if (ord >= fromOrd && ord <= toOrd) result.push(sem);
    }
  }
  return result;
}

// ── Internal data types ───────────────────────────────────────────────────────

interface CourseSection {
  term: string;       // "Fall" | "Spring" | "Summer"
  days: string;       // e.g. "M,W,F"
  startTime: string;  // "HH:MM" 24h
  endTime: string;    // "HH:MM" 24h
}

interface CourseNode {
  id: number;
  code: string;
  title: string;
  credits: number;
  offeredTerms: string[];
  prereqIds: number[];
  /** Historical section times, deduplicated by term+days+times. Empty = no data. */
  sections: CourseSection[];
}

interface HubPool {
  areaCode: string;
  unitsStillNeeded: number;
  courses: CourseNode[];
}

interface MajorGroup {
  programCode: string;
  programType: string;
  groupName: string;
  stillNeeded: number;
  required: CourseNode[];
  electives: CourseNode[];
}

interface SchoolReqCourse {
  reqId: string;
  reqName: string;
  course: CourseNode;
}

interface PlanContext {
  doneIds: Set<number>;
  doneCodes: Set<string>;
  pinnedMap: Map<number, string>;
  availableSems: string[];
  existingLoad: Map<string, number>;
  hubPools: HubPool[];
  majorGroups: MajorGroup[];
  /** IDs of courses belonging to major (not minor) programs — used for per-sem limit. */
  majorOnlyCourseIds: Set<number>;
  fillerCourses: CourseNode[];
  creditTarget: number;
  courseInfo: Map<number, CourseNode>;
  /**
   * Maps courseId → list of MISSING hub area codes the course covers.
   * Used to give a priority bonus to courses that cover multiple needed areas.
   */
  courseMissingHubAreas: Map<number, string[]>;
  /** Courses that satisfy unsatisfied school-specific requirements */
  schoolReqCourses: SchoolReqCourse[];
  /** Active program codes for validation */
  programCodes: string[];
  /** User's completed+in-progress course entries for school-req validation */
  doneEntries: CourseEntry[];
}

// ── Helper: fetch and cache CourseNode rows ───────────────────────────────────

async function fetchCourseNodes(ids: number[]): Promise<CourseNode[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.course.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, code: true, title: true, credits: true,
      schedules: { select: { semester: true, days: true, startTime: true, endTime: true } },
      prerequisiteLinks: { select: { prerequisiteId: true } },
    },
  });
  return rows.map((c) => {
    // Deduplicate sections by term+days+start+end
    const seen = new Set<string>();
    const sections: CourseSection[] = [];
    for (const s of c.schedules) {
      if (!s.days || !s.startTime || !s.endTime) continue;
      const term = s.semester.split(" ")[0];
      const key  = `${term}|${s.days}|${s.startTime}|${s.endTime}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sections.push({ term, days: s.days, startTime: s.startTime, endTime: s.endTime });
    }
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      credits: c.credits,
      offeredTerms: [...new Set(c.schedules.map((s) => s.semester.split(" ")[0]))],
      prereqIds: c.prerequisiteLinks.map((p) => p.prerequisiteId),
      sections,
    };
  });
}

// ── Phase 1: Shared data fetch ────────────────────────────────────────────────

async function fetchPlanContext(
  userId: string,
  pinnedCourses: { courseId: number; semester: string }[],
  endSemesterOverride?: string,
): Promise<PlanContext> {

  // 1a. Done / in-progress courses
  const doneRows = await prisma.userCourseProgress.findMany({
    where: { userId, status: { in: ["completed", "in-progress"] } },
    include: { course: { select: { id: true, code: true, title: true, credits: true, department: true } } },
  });
  const doneIds    = new Set(doneRows.map((r) => r.courseId));
  const doneCodes  = new Set(doneRows.map((r) => r.course.code));
  // Both completed AND in-progress credits count toward the target,
  // because in-progress courses are excluded from planning (in doneIds).
  const creditsDone = doneRows.reduce((s, r) => s + r.course.credits, 0);
  // Build CourseEntry list for school-requirement checks
  const doneEntries: CourseEntry[] = doneRows.map((r) => ({
    course: { code: r.course.code, title: r.course.title, department: r.course.department, credits: r.course.credits },
    status: r.status as "completed" | "in-progress",
  }));

  // 1b. Available semesters
  const profile    = await prisma.userProfile.findUnique({ where: { id: userId } });
  const currentSem = getCurrentSemester();
  const rawEndSem  = endSemesterOverride || profile?.endSemester || "";
  const endSem     = rawEndSem && compareSemesters(rawEndSem, currentSem) > 0
    ? rawEndSem
    : `Spring ${new Date().getFullYear() + 4}`;

  const availableSems = buildAvailableSems(currentSem, endSem);

  // 1c. In-progress load per semester
  const inProgRows = await prisma.userCourseProgress.findMany({
    where: { userId, status: "in-progress", semester: { in: availableSems } },
    select: { semester: true },
  });
  const existingLoad = new Map<string, number>(availableSems.map((s) => [s, 0]));
  for (const r of inProgRows) {
    existingLoad.set(r.semester, (existingLoad.get(r.semester) ?? 0) + 1);
  }

  // 1d. Active programs (majors + minors)
  const userProgramIds = (await prisma.userProgram.findMany({
    where: { userId }, select: { programId: true },
  })).map((r) => r.programId);

  const programs = userProgramIds.length > 0
    ? await prisma.program.findMany({
        where: { id: { in: userProgramIds } },
        include: { requirements: { include: { courses: true }, orderBy: { groupName: "asc" } } },
      })
    : [];

  // 1e. Credit target
  const activeMajors = programs.filter((p) => p.type === "major" || p.type === "joint-major");
  const { credits: creditsRequired } = computeCreditsRequired(
    activeMajors.map((p) => ({ code: p.code }))
  );
  const creditTarget = Math.max(0, creditsRequired - creditsDone);

  // 1f. Major/minor course code → ID mapping
  const allProgramCodes = programs.flatMap((p) =>
    p.requirements.flatMap((g) => g.courses.map((c) => c.courseCode))
  );
  const programCourseLookup = allProgramCodes.length > 0
    ? await prisma.course.findMany({
        where: { code: { in: allProgramCodes } },
        select: { id: true, code: true },
      })
    : [];
  const idByCode = new Map(programCourseLookup.map((c) => [c.code, c.id]));

  // 1g. Hub area analysis
  const allHubAreas = await prisma.hubArea.findMany();
  const hubContrib  = await prisma.courseHubArea.findMany({
    where: { courseId: { in: doneIds.size > 0 ? [...doneIds] : [-1] } },
    select: { hubAreaId: true },
  });
  const contribCount = new Map<number, number>();
  for (const c of hubContrib) {
    contribCount.set(c.hubAreaId, (contribCount.get(c.hubAreaId) ?? 0) + 1);
  }
  const missingAreaIds = allHubAreas
    .filter((a) => (contribCount.get(a.id) ?? 0) < a.unitsRequired)
    .map((a) => a.id);

  // 1h. Hub candidate courses — no global `take`; cap at 50 per area in code.
  // (The old `take: missingAreaIds.length * 30` was a global cap that starved
  //  hub areas later in the list of any candidates.)
  const hubLinksRaw = missingAreaIds.length > 0
    ? await prisma.courseHubArea.findMany({
        where: {
          hubAreaId: { in: missingAreaIds },
          courseId: { notIn: doneIds.size > 0 ? [...doneIds] : [-1] },
        },
        include: {
          course: { select: { id: true, code: true, title: true, credits: true } },
          hubArea: { select: { id: true, code: true, unitsRequired: true } },
        },
      })
    : [];

  const linksByArea = new Map<number, typeof hubLinksRaw>();
  for (const link of hubLinksRaw) {
    if (!linksByArea.has(link.hubAreaId)) linksByArea.set(link.hubAreaId, []);
    const arr = linksByArea.get(link.hubAreaId)!;
    if (arr.length < 50) arr.push(link);
  }
  const hubLinks = [...linksByArea.values()].flat();

  // Build courseMissingHubAreas: courseId → all missing hub area codes it covers.
  // Use hubLinksRaw (before the per-area cap) for a complete picture of each course's reach.
  const courseMissingHubAreas = new Map<number, string[]>();
  for (const link of hubLinksRaw) {
    if (!courseMissingHubAreas.has(link.courseId)) courseMissingHubAreas.set(link.courseId, []);
    courseMissingHubAreas.get(link.courseId)!.push(link.hubArea.code);
  }

  // 1i. Collect all candidate IDs
  const hubCandidateIds   = new Set(hubLinks.map((l) => l.courseId));
  const majorCandidateIds = new Set<number>();
  for (const code of allProgramCodes) {
    const id = idByCode.get(code);
    if (id && !doneIds.has(id)) majorCandidateIds.add(id);
  }
  const pinnedMap = new Map(pinnedCourses.map((p) => [p.courseId, p.semester]));
  for (const id of pinnedMap.keys()) {
    if (!doneIds.has(id)) hubCandidateIds.add(id);
  }

  const allCandidateIds = [...new Set([...hubCandidateIds, ...majorCandidateIds])];

  // 1j. Fetch CourseNode data
  const candidateNodes = await fetchCourseNodes(allCandidateIds);
  const courseInfo     = new Map<number, CourseNode>();
  for (const n of candidateNodes) courseInfo.set(n.id, n);

  // 1k. Resolve prerequisites — up to 4 levels deep
  let frontier = [...allCandidateIds];
  for (let depth = 0; depth < 4; depth++) {
    const needed = new Set<number>();
    for (const id of frontier) {
      const node = courseInfo.get(id);
      if (!node) continue;
      for (const pid of node.prereqIds) {
        if (!doneIds.has(pid) && !courseInfo.has(pid)) needed.add(pid);
      }
    }
    if (needed.size === 0) break;
    const newNodes = await fetchCourseNodes([...needed]);
    for (const n of newNodes) courseInfo.set(n.id, n);
    frontier = [...needed];
  }

  // 1l. Build hub pools
  const hubPoolMap = new Map<number, HubPool>();
  for (const link of hubLinks) {
    const node = courseInfo.get(link.courseId);
    if (!node) continue;
    if (!hubPoolMap.has(link.hubAreaId)) {
      const area = allHubAreas.find((a) => a.id === link.hubAreaId)!;
      hubPoolMap.set(link.hubAreaId, {
        areaCode: area.code,
        unitsStillNeeded: area.unitsRequired - (contribCount.get(area.id) ?? 0),
        courses: [],
      });
    }
    hubPoolMap.get(link.hubAreaId)!.courses.push(node);
  }
  const hubPools = [...hubPoolMap.values()];

  // 1m. Build major / minor groups
  const majorGroups: MajorGroup[] = [];
  for (const prog of programs) {
    for (const grp of prog.requirements) {
      const doneCourseCount = grp.courses.filter((c) => doneCodes.has(c.courseCode)).length;
      const stillNeeded     = Math.max(0, grp.minCourses - doneCourseCount);
      const required: CourseNode[] = [];
      const electives: CourseNode[] = [];
      for (const c of grp.courses) {
        if (doneCodes.has(c.courseCode)) continue;
        const id = idByCode.get(c.courseCode);
        if (!id) continue;
        const node = courseInfo.get(id);
        if (!node) continue;
        (c.isRequired ? required : electives).push(node);
      }
      if (stillNeeded === 0 && required.length === 0) continue;
      majorGroups.push({ programCode: prog.code, programType: prog.type, groupName: grp.groupName, stillNeeded, required, electives });
    }
  }

  // 1m-2. Dynamic elective discovery for empty requirement groups.
  // Mirrors progress.ts logic: find 300/400/500-level courses in the program's
  // primary department, excluding only courses actually consumed by other groups.
  // Courses in pick-N groups (e.g. Group B) are only consumed up to minCourses;
  // surplus completed courses spill into this dynamic elective pool.
  {
    const emptyGroups = majorGroups.filter(
      (g) => g.required.length === 0 && g.electives.length === 0 && g.stillNeeded > 0
    );

    if (emptyGroups.length > 0) {
      // Get department for each known program course code
      const deptRows = await prisma.course.findMany({
        where: { code: { in: allProgramCodes } },
        select: { code: true, department: true },
      });
      const deptByCode = new Map(deptRows.map((r) => [r.code, r.department]));

      for (const grp of emptyGroups) {
        const prog = programs.find((p) => p.code === grp.programCode);
        if (!prog) continue;

        // Build set of codes truly consumed by other groups
        const consumedCodes = new Set<string>();
        for (const other of prog.requirements) {
          if (other.courses.length === 0) continue;

          const allRequired = other.courses.filter((c) => c.isRequired);
          const allElective = other.courses.filter((c) => !c.isRequired);

          // Required courses are always consumed
          for (const c of allRequired) consumedCodes.add(c.courseCode);

          // For elective slots: only consume up to minCourses minus required count
          const electiveSlotsNeeded = Math.max(0, other.minCourses - allRequired.length);
          // Prioritise completed courses as consumed; rest spill over
          const sortedElectives = [...allElective].sort((a, b) => {
            const da = doneCodes.has(a.courseCode) ? 0 : 1;
            const db = doneCodes.has(b.courseCode) ? 0 : 1;
            return da - db;
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
          .filter((r) => r.courses.length > 0)
          .flatMap((r) => r.courses.map((c) => c.courseCode));

        // Infer primary department from other groups' courses
        const deptCounts = new Map<string, number>();
        for (const code of allOtherCodes) {
          const dept = deptByCode.get(code);
          if (dept) deptCounts.set(dept, (deptCounts.get(dept) ?? 0) + 1);
        }
        const primaryDept = [...deptCounts.entries()]
          .sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!primaryDept) continue;

        // Query all courses in primary department
        const deptCourses = await prisma.course.findMany({
          where: { department: primaryDept },
          select: { id: true, code: true },
        });

        // Filter: 300+ level, not consumed by other groups, not done
        const candidates = deptCourses.filter((c) => {
          if (consumedCodes.has(c.code)) return false;
          if (doneIds.has(c.id)) return false;
          const num = parseInt(c.code.replace(/\D/g, ""), 10);
          return !Number.isNaN(num) && num >= 300;
        });

        // Fetch CourseNode data for new courses
        const newIds = candidates.map((c) => c.id).filter((id) => !courseInfo.has(id));
        if (newIds.length > 0) {
          const newNodes = await fetchCourseNodes(newIds);
          for (const n of newNodes) courseInfo.set(n.id, n);
        }

        // Resolve prereqs for new courses (up to 4 levels deep)
        let prFrontier = [...newIds];
        for (let depth = 0; depth < 4 && prFrontier.length > 0; depth++) {
          const needed = new Set<number>();
          for (const id of prFrontier) {
            const node = courseInfo.get(id);
            if (!node) continue;
            for (const pid of node.prereqIds) {
              if (!doneIds.has(pid) && !courseInfo.has(pid)) needed.add(pid);
            }
          }
          if (needed.size === 0) break;
          const moreNodes = await fetchCourseNodes([...needed]);
          for (const n of moreNodes) courseInfo.set(n.id, n);
          prFrontier = [...needed];
        }

        // Set as group's electives
        grp.electives = candidates
          .map((c) => courseInfo.get(c.id))
          .filter((n): n is CourseNode => n !== undefined);
      }

      // Update hub area tracking for dynamically discovered courses
      const dynamicIds = emptyGroups.flatMap((g) => g.electives.map((c) => c.id));
      if (dynamicIds.length > 0 && missingAreaIds.length > 0) {
        const extraHubLinks = await prisma.courseHubArea.findMany({
          where: { courseId: { in: dynamicIds }, hubAreaId: { in: missingAreaIds } },
          include: { hubArea: { select: { code: true } } },
        });
        for (const link of extraHubLinks) {
          if (!courseMissingHubAreas.has(link.courseId))
            courseMissingHubAreas.set(link.courseId, []);
          courseMissingHubAreas.get(link.courseId)!.push(link.hubArea.code);
        }
      }
    }
  }

  // 1n. Build the "major only" course ID set (for per-semester major limit).
  // Minor and joint-major courses are excluded from this limit so they don't
  // compete with full major courses in the per-semester cap.
  const majorOnlyCourseIds = new Set<number>();
  for (const prog of programs) {
    if (prog.type !== "major") continue;
    for (const grp of prog.requirements) {
      for (const c of grp.courses) {
        const id = idByCode.get(c.courseCode);
        if (id) majorOnlyCourseIds.add(id);
      }
    }
  }
  // Also include dynamically discovered electives
  for (const grp of majorGroups) {
    if (grp.programType !== "major") continue;
    for (const c of grp.electives) majorOnlyCourseIds.add(c.id);
  }

  // 1n-2. School-specific requirement courses
  const programCodes = programs.map((p) => p.code);
  const schoolReqCourses: SchoolReqCourse[] = [];
  {
    // Collect unsatisfied school-req search criteria from all active programs
    const allCriteria: SchoolReqSearchCriterion[] = [];
    for (const prog of programs) {
      if (prog.type === "minor") continue; // minors don't have school-specific reqs
      const criteria = getUnsatisfiedSchoolReqCriteria(prog.code, doneEntries);
      allCriteria.push(...criteria);
    }

    if (allCriteria.length > 0) {
      // Query DB for candidate courses matching each criterion
      for (const crit of allCriteria) {
        if (!crit.departments || crit.departments.length === 0) continue;

        const where: Record<string, unknown> = {
          department: { in: crit.departments },
          id: { notIn: doneIds.size > 0 ? [...doneIds] : [-1] },
        };

        const candidates = await prisma.course.findMany({
          where,
          select: { id: true, code: true },
          take: 20,
        });

        // Filter by course number constraints
        const filtered = candidates.filter((c) => {
          const num = courseNum(c.code);
          if (crit.courseNumbers && crit.courseNumbers.length > 0) {
            return crit.courseNumbers.includes(num);
          }
          if (crit.minCourseNum) {
            return num >= crit.minCourseNum;
          }
          return true;
        });

        // Fetch CourseNode data for new courses
        const newIds = filtered.map((c) => c.id).filter((id) => !courseInfo.has(id));
        if (newIds.length > 0) {
          const newNodes = await fetchCourseNodes(newIds);
          for (const n of newNodes) courseInfo.set(n.id, n);
        }

        // Resolve prereqs for new courses (up to 4 levels deep)
        let srFrontier = [...newIds];
        for (let depth = 0; depth < 4 && srFrontier.length > 0; depth++) {
          const needed = new Set<number>();
          for (const id of srFrontier) {
            const node = courseInfo.get(id);
            if (!node) continue;
            for (const pid of node.prereqIds) {
              if (!doneIds.has(pid) && !courseInfo.has(pid)) needed.add(pid);
            }
          }
          if (needed.size === 0) break;
          const moreNodes = await fetchCourseNodes([...needed]);
          for (const n of moreNodes) courseInfo.set(n.id, n);
          srFrontier = [...needed];
        }

        // Add to schoolReqCourses (pick best match — fewest prereqs first)
        for (const c of filtered) {
          const node = courseInfo.get(c.id);
          if (!node) continue;
          schoolReqCourses.push({ reqId: crit.reqId, reqName: crit.reqName, course: node });
        }
      }

      // Update hub area tracking for school-req courses
      const srIds = schoolReqCourses.map((s) => s.course.id).filter((id) => !courseMissingHubAreas.has(id));
      if (srIds.length > 0 && missingAreaIds.length > 0) {
        const extraHubLinks = await prisma.courseHubArea.findMany({
          where: { courseId: { in: srIds }, hubAreaId: { in: missingAreaIds } },
          include: { hubArea: { select: { code: true } } },
        });
        for (const link of extraHubLinks) {
          if (!courseMissingHubAreas.has(link.courseId))
            courseMissingHubAreas.set(link.courseId, []);
          courseMissingHubAreas.get(link.courseId)!.push(link.hubArea.code);
        }
      }
    }
  }

  // 1o. Filler pool for credit gap
  const fillerIds = new Set<number>();
  for (const link of hubLinks) {
    if (courseInfo.has(link.courseId)) fillerIds.add(link.courseId);
  }
  for (const grp of majorGroups) {
    for (const c of grp.electives) fillerIds.add(c.id);
  }
  const fillerCourses = [...fillerIds].map((id) => courseInfo.get(id)!).filter(Boolean);

  return {
    doneIds,
    doneCodes,
    pinnedMap,
    availableSems,
    existingLoad,
    hubPools,
    majorGroups,
    majorOnlyCourseIds,
    fillerCourses,
    creditTarget,
    courseInfo,
    courseMissingHubAreas,
    schoolReqCourses,
    programCodes,
    doneEntries,
  };
}

// ── Phase 2: Pure assignment algorithm ───────────────────────────────────────

// ── Schedule-conflict helpers ─────────────────────────────────────────────────

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function daysIntersect(d1: string, d2: string): boolean {
  const set1 = new Set(d1.split(",").map((d) => d.trim()));
  return d2.split(",").some((d) => set1.has(d.trim()));
}

function sectionsOverlap(a: CourseSection, b: CourseSection): boolean {
  if (!daysIntersect(a.days, b.days)) return false;
  const aS = toMinutes(a.startTime), aE = toMinutes(a.endTime);
  const bS = toMinutes(b.startTime), bE = toMinutes(b.endTime);
  return aS < bE && bS < aE;
}

/**
 * Returns true if at least ONE combination of (section from A, section from B)
 * does NOT overlap — meaning the student could take both courses this term.
 * Returns true (assume OK) when either course has no section data for the term.
 */
function canCoexist(a: CourseSection[], b: CourseSection[], term: string): boolean {
  const secsA = a.filter((s) => s.term === term);
  const secsB = b.filter((s) => s.term === term);
  if (secsA.length === 0 || secsB.length === 0) return true; // no data → optimistic
  for (const sa of secsA) {
    for (const sb of secsB) {
      if (!sectionsOverlap(sa, sb)) return true; // valid non-conflicting combo found
    }
  }
  return false; // every possible combo conflicts
}

function rotate<T>(arr: T[], rot: 0 | 1 | 2): T[] {
  if (rot === 0 || arr.length < 3) return arr;
  const shift = Math.floor(arr.length * rot / 3);
  return [...arr.slice(shift), ...arr.slice(0, shift)];
}

function runVariant(
  ctx: PlanContext,
  cfg: VariantConfig,
  opts: GenerateOptions,
): { assignments: GeneratedAssignment[]; earliestFinish: string | null } {
  const {
    doneIds, pinnedMap, availableSems, existingLoad,
    hubPools, majorGroups, majorOnlyCourseIds, fillerCourses, creditTarget, courseInfo,
    courseMissingHubAreas,
  } = ctx;

  if (availableSems.length === 0) return { assignments: [], earliestFinish: null };

  const effectiveMax = Math.min(cfg.maxLoad, opts.maxCoursesPerSem ?? 4);
  const summerCap    = 2;
  const majorCap     = opts.majorCoursesPerSem ?? 2;

  function semCap(sem: string): number {
    return sem.startsWith("Summer") ? Math.min(summerCap, effectiveMax) : effectiveMax;
  }

  const semLoad      = new Map<string, number>(availableSems.map((s) => [s, existingLoad.get(s) ?? 0]));
  const majorSemLoad = new Map<string, number>(availableSems.map((s) => [s, 0]));
  const assignments  = new Map<number, string>();

  // ── Shared helpers (close over mutable maps) ─────────────────────────────

  function prereqsMet(id: number, sem: string): boolean {
    const node = courseInfo.get(id);
    if (!node) return true;
    const ord = semOrd(sem);
    for (const pid of node.prereqIds) {
      if (doneIds.has(pid)) continue;
      const aSem = assignments.get(pid);
      if (!aSem || semOrd(aSem) >= ord) return false;
    }
    return true;
  }

  function offeredIn(id: number, sem: string): boolean {
    const node = courseInfo.get(id);
    if (!node || node.offeredTerms.length === 0) return true;
    return node.offeredTerms.includes(sem.split(" ")[0]);
  }

  function noScheduleConflict(id: number, sem: string): boolean {
    const node = courseInfo.get(id);
    if (!node || node.sections.length === 0) return true;
    const term = sem.split(" ")[0];
    for (const [assignedId, assignedSem] of assignments) {
      if (assignedSem !== sem) continue;
      const other = courseInfo.get(assignedId);
      if (!other) continue;
      if (!canCoexist(node.sections, other.sections, term)) return false;
    }
    return true;
  }

  function tryAssign(id: number): boolean {
    if (doneIds.has(id) || assignments.has(id)) return true;
    const isMajorCourse = majorCap > 0 && majorOnlyCourseIds.has(id);
    for (const sem of availableSems) {
      if ((semLoad.get(sem) ?? 0) >= semCap(sem)) continue;
      if (isMajorCourse && (majorSemLoad.get(sem) ?? 0) >= majorCap) continue;
      if (!prereqsMet(id, sem)) continue;
      if (!offeredIn(id, sem)) continue;
      if (!noScheduleConflict(id, sem)) continue;
      assignments.set(id, sem);
      semLoad.set(sem, (semLoad.get(sem) ?? 0) + 1);
      if (isMajorCourse) majorSemLoad.set(sem, (majorSemLoad.get(sem) ?? 0) + 1);
      return true;
    }
    return false;
  }

  /**
   * Relaxed assignment for required courses that the main pass couldn't place.
   * Tries progressively looser constraints so a required course is never silently
   * dropped just because of soft preferences:
   *   Attempt 1 — drop majorCap + scheduleConflict, keep offeredIn
   *   Attempt 2 — drop offeredIn too (just need prereqs met + a free slot)
   */
  function tryAssignRelaxed(id: number): boolean {
    if (doneIds.has(id) || assignments.has(id)) return true;
    const isMajorCourse = majorCap > 0 && majorOnlyCourseIds.has(id);
    // Attempt 1: keep offeredIn, drop majorCap + schedule-conflict
    for (const sem of availableSems) {
      if ((semLoad.get(sem) ?? 0) >= semCap(sem)) continue;
      if (!prereqsMet(id, sem)) continue;
      if (!offeredIn(id, sem)) continue;
      assignments.set(id, sem);
      semLoad.set(sem, (semLoad.get(sem) ?? 0) + 1);
      if (isMajorCourse) majorSemLoad.set(sem, (majorSemLoad.get(sem) ?? 0) + 1);
      return true;
    }
    // Attempt 2: also drop offeredIn — just find any semester with a free slot
    for (const sem of availableSems) {
      if ((semLoad.get(sem) ?? 0) >= semCap(sem)) continue;
      if (!prereqsMet(id, sem)) continue;
      assignments.set(id, sem);
      semLoad.set(sem, (semLoad.get(sem) ?? 0) + 1);
      if (isMajorCourse) majorSemLoad.set(sem, (majorSemLoad.get(sem) ?? 0) + 1);
      return true;
    }
    return false;
  }

  /**
   * Given (courseId, priority) pairs, expand their unassigned prereqs, run
   * Kahn's topological sort (highest priority first), and return the sorted
   * list of IDs ready to feed into tryAssign.
   */
  function topoSort(pairs: [number, number][]): number[] {
    const priority = new Map<number, number>();
    for (const [id, p] of pairs) {
      if (doneIds.has(id) || assignments.has(id)) continue;
      const ex = priority.get(id);
      if (ex === undefined || p > ex) priority.set(id, p);
    }
    if (priority.size === 0) return [];

    // Pull unassigned prereqs (up to 4 levels deep)
    let frontier = [...priority.keys()];
    for (let depth = 0; depth < 4 && frontier.length > 0; depth++) {
      const next: number[] = [];
      for (const id of frontier) {
        const node = courseInfo.get(id);
        if (!node) continue;
        for (const pid of node.prereqIds) {
          if (doneIds.has(pid) || assignments.has(pid) || priority.has(pid)) continue;
          priority.set(pid, 15);
          next.push(pid);
        }
      }
      frontier = next;
    }

    const activeIds  = [...priority.keys()];
    const dependents = new Map<number, number[]>(activeIds.map((id) => [id, []]));
    const inDegree   = new Map<number, number>(activeIds.map((id) => [id, 0]));

    for (const id of activeIds) {
      const node = courseInfo.get(id);
      if (!node) continue;
      for (const pid of node.prereqIds) {
        if (doneIds.has(pid) || assignments.has(pid) || !priority.has(pid)) continue;
        dependents.get(pid)?.push(id);
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
      }
    }

    const byP   = (a: number, b: number) => (priority.get(b) ?? 0) - (priority.get(a) ?? 0);
    const queue = activeIds.filter((id) => (inDegree.get(id) ?? 0) === 0).sort(byP);
    const order: number[] = [];

    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const dep of dependents.get(id) ?? []) {
        const nd = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, nd);
        if (nd === 0) {
          const at = queue.findIndex((q) => byP(q, dep) > 0);
          if (at === -1) queue.push(dep); else queue.splice(at, 0, dep);
        }
      }
    }
    // Fallback for cycles
    for (const id of activeIds) {
      if (!order.includes(id)) order.push(id);
    }
    return order;
  }

  // ── Pinned courses (highest priority; locked to user-chosen semester) ─────
  for (const [id, sem] of pinnedMap) {
    if (doneIds.has(id) || !availableSems.includes(sem)) continue;
    if ((semLoad.get(sem) ?? 0) >= semCap(sem)) continue;
    assignments.set(id, sem);
    semLoad.set(sem, (semLoad.get(sem) ?? 0) + 1);
    if (majorCap > 0 && majorOnlyCourseIds.has(id)) {
      majorSemLoad.set(sem, (majorSemLoad.get(sem) ?? 0) + 1);
    }
  }

  // ── Phase 1 — Major / minor program courses ───────────────────────────────
  // Four sub-steps so electives are never starved by required courses:
  //   1a. Place ALL required courses first (single topo-sort, no electives).
  //   1b. Per-group elective placement with explicit need tracking.
  //   1c. Relaxed recovery for any required courses still unplaced.
  //   1d. Relaxed recovery for groups still below their minimum.
  {
    // ── Step 1a: required courses only ────────────────────────────────────
    {
      const reqPairs: [number, number][] = [];
      for (const grp of majorGroups) {
        const isMajor = grp.programType === "major" || grp.programType === "joint-major";
        const reqP    = isMajor ? 20 : 14;
        const reqRot  = rotate(grp.required, cfg.mRot);
        for (let i = 0; i < reqRot.length; i++) {
          reqPairs.push([reqRot[i].id, i < grp.stillNeeded ? reqP : reqP - 3]);
        }
      }
      for (const id of topoSort(reqPairs)) tryAssign(id);
    }

    // ── Step 1b: per-group elective placement ─────────────────────────────
    // Process each group independently so one group can't starve another.
    // Sort electives by hub coverage (descending) so major electives pull
    // double duty as hub satisfiers — the "laziest" path.
    for (const grp of majorGroups) {
      const isMajor = grp.programType === "major" || grp.programType === "joint-major";
      const elecP   = isMajor ? 12 : 8;
      const grpIds  = new Set([...grp.required, ...grp.electives].map((c) => c.id));
      let need = Math.max(
        0,
        grp.stillNeeded - [...assignments.keys()].filter((id) => grpIds.has(id)).length,
      );
      if (need === 0) continue;

      // Sort electives: courses covering more missing hub areas first
      const elecSorted = [...grp.electives].sort((a, b) => {
        const aHub = courseMissingHubAreas.get(a.id)?.length ?? 0;
        const bHub = courseMissingHubAreas.get(b.id)?.length ?? 0;
        return bHub - aHub;
      });
      const elecRot   = rotate(elecSorted, cfg.mRot);
      const elecLimit = Math.min(elecRot.length, need + 8);
      const elecPairs: [number, number][] = elecRot
        .slice(0, elecLimit)
        .map((c, i) => [c.id, i < need ? elecP : elecP - 3] as [number, number]);

      for (const id of topoSort(elecPairs)) {
        if (need <= 0) break;
        if (grpIds.has(id)) {
          // This ID is a group member (required or elective already in grpIds)
          if (assignments.has(id)) { need--; continue; }
          if (tryAssign(id)) need--;
        } else {
          // This ID is a prerequisite dragged in by topoSort — place it without
          // counting toward the group's elective minimum.
          tryAssign(id);
        }
      }
    }

    // ── Step 1c: relaxed recovery for unplaced required courses ───────────
    {
      const unplacedRequired = majorGroups.flatMap((grp) =>
        grp.required.filter((c) => !assignments.has(c.id))
      );
      if (unplacedRequired.length > 0) {
        const prereqPairs: [number, number][] = unplacedRequired.flatMap((c) =>
          c.prereqIds
            .filter((pid) => !doneIds.has(pid) && !assignments.has(pid) && courseInfo.has(pid))
            .map((pid) => [pid, 18] as [number, number])
        );
        for (const pid of topoSort(prereqPairs)) tryAssignRelaxed(pid);
        for (const c of unplacedRequired) tryAssignRelaxed(c.id);
      }
    }

    // ── Step 1d: relaxed recovery for groups still below their minimum ────
    // Sort by hub coverage so recovery also prefers multi-hub courses.
    for (const grp of majorGroups) {
      const grpIds  = new Set([...grp.required, ...grp.electives].map((c) => c.id));
      let stillNeed = Math.max(
        0,
        grp.stillNeeded - [...assignments.keys()].filter((id) => grpIds.has(id)).length,
      );
      if (stillNeed === 0) continue;

      const sorted1d = [...grp.electives].sort((a, b) => {
        const aHub = courseMissingHubAreas.get(a.id)?.length ?? 0;
        const bHub = courseMissingHubAreas.get(b.id)?.length ?? 0;
        return bHub - aHub;
      });
      for (const c of rotate(sorted1d, cfg.mRot)) {
        if (stillNeed <= 0) break;
        if (assignments.has(c.id)) { stillNeed--; continue; }
        const prereqPairs2: [number, number][] = c.prereqIds
          .filter((pid) => !doneIds.has(pid) && !assignments.has(pid) && courseInfo.has(pid))
          .map((pid) => [pid, 18] as [number, number]);
        for (const pid of topoSort(prereqPairs2)) tryAssignRelaxed(pid);
        if (tryAssignRelaxed(c.id)) stillNeed--;
      }
    }
  }

  // ── Phase 1.5 — School-specific requirements ────────────────────────────
  // Place courses satisfying unsatisfied school-specific requirements.
  // Prioritize courses that also cover hub areas (double-duty).
  {
    const { schoolReqCourses } = ctx;
    // Group by reqId, pick best candidate per req (most hub coverage first)
    const byReq = new Map<string, SchoolReqCourse[]>();
    for (const src of schoolReqCourses) {
      if (doneIds.has(src.course.id) || assignments.has(src.course.id)) continue;
      if (!byReq.has(src.reqId)) byReq.set(src.reqId, []);
      byReq.get(src.reqId)!.push(src);
    }

    for (const [, candidates] of byReq) {
      // Sort: most hub areas covered first, then fewest prereqs
      candidates.sort((a, b) => {
        const aHub = courseMissingHubAreas.get(a.course.id)?.length ?? 0;
        const bHub = courseMissingHubAreas.get(b.course.id)?.length ?? 0;
        if (bHub !== aHub) return bHub - aHub;
        return a.course.prereqIds.length - b.course.prereqIds.length;
      });

      let placed = false;
      for (const cand of candidates) {
        if (placed) break;
        if (assignments.has(cand.course.id)) { placed = true; break; }
        // Place prereqs first
        for (const pid of cand.course.prereqIds) {
          if (!doneIds.has(pid) && !assignments.has(pid) && courseInfo.has(pid)) {
            tryAssign(pid);
          }
        }
        if (tryAssign(cand.course.id)) placed = true;
      }
      // Relaxed fallback if no candidate was placed
      if (!placed) {
        for (const cand of candidates) {
          if (assignments.has(cand.course.id)) break;
          for (const pid of cand.course.prereqIds) {
            if (!doneIds.has(pid) && !assignments.has(pid) && courseInfo.has(pid)) {
              tryAssignRelaxed(pid);
            }
          }
          if (tryAssignRelaxed(cand.course.id)) break;
        }
      }
    }
  }

  // ── Phase 2 — Hub requirement courses (greedy set-cover) ─────────────────
  // Uses a greedy approach: repeatedly pick the unplaced course that covers
  // the most CURRENTLY-unsatisfied hub areas. This minimises total courses
  // (laziest path) and ensures every hub area is satisfied.
  {
    // Build remaining hub needs, subtracting contributions from Phase 1.
    const hubRemaining = new Map<string, number>();
    for (const pool of hubPools) {
      hubRemaining.set(pool.areaCode, pool.unitsStillNeeded);
    }
    for (const id of assignments.keys()) {
      const areas = courseMissingHubAreas.get(id);
      if (!areas) continue;
      for (const areaCode of areas) {
        const rem = hubRemaining.get(areaCode);
        if (rem !== undefined && rem > 0) hubRemaining.set(areaCode, rem - 1);
      }
    }

    // Collect all hub candidate IDs (from all pools, deduplicated).
    const hubCandidateSet = new Set<number>();
    for (const pool of hubPools) {
      for (const c of pool.courses) {
        if (!assignments.has(c.id) && !doneIds.has(c.id)) hubCandidateSet.add(c.id);
      }
    }

    const hubTotalRemaining = () =>
      [...hubRemaining.values()].reduce((s, v) => s + Math.max(0, v), 0);

    // Helper: score a candidate by how many still-unsatisfied areas it covers.
    function hubScore(id: number): number {
      const areas = courseMissingHubAreas.get(id);
      if (!areas) return 0;
      let score = 0;
      for (const areaCode of areas) {
        if ((hubRemaining.get(areaCode) ?? 0) > 0) score++;
      }
      return score;
    }

    // Helper: after placing a course, decrement hubRemaining for its areas.
    function decrementHub(id: number) {
      const areas = courseMissingHubAreas.get(id);
      if (!areas) return;
      for (const areaCode of areas) {
        const rem = hubRemaining.get(areaCode);
        if (rem !== undefined && rem > 0) hubRemaining.set(areaCode, rem - 1);
      }
    }

    // ── Main greedy loop — strict constraints ─────────────────────────────
    while (hubTotalRemaining() > 0) {
      let bestId = -1;
      let bestScore = 0;
      for (const id of hubCandidateSet) {
        if (assignments.has(id)) continue;
        const sc = hubScore(id);
        if (sc > bestScore) { bestScore = sc; bestId = id; }
      }
      if (bestId === -1 || bestScore === 0) break;

      // Place prereqs first
      const node = courseInfo.get(bestId);
      if (node) {
        for (const pid of node.prereqIds) {
          if (!doneIds.has(pid) && !assignments.has(pid) && courseInfo.has(pid)) {
            tryAssign(pid);
          }
        }
      }
      if (tryAssign(bestId)) {
        decrementHub(bestId);
      } else {
        hubCandidateSet.delete(bestId); // unplaceable, skip permanently
      }
    }

    // ── Recovery — greedy with relaxed constraints ────────────────────────
    while (hubTotalRemaining() > 0) {
      let bestId = -1;
      let bestScore = 0;
      for (const id of hubCandidateSet) {
        if (assignments.has(id)) continue;
        const sc = hubScore(id);
        if (sc > bestScore) { bestScore = sc; bestId = id; }
      }
      if (bestId === -1 || bestScore === 0) break;

      const node = courseInfo.get(bestId);
      if (node) {
        for (const pid of node.prereqIds) {
          if (!doneIds.has(pid) && !assignments.has(pid) && courseInfo.has(pid)) {
            tryAssignRelaxed(pid);
          }
        }
      }
      if (tryAssignRelaxed(bestId)) {
        decrementHub(bestId);
      } else {
        hubCandidateSet.delete(bestId);
      }
    }
  }

  // ── Phase 3 — Smart credit-gap filler ─────────────────────────────────────
  // Score fillers by how much "work" they do beyond raw credits:
  //   - Covering unsatisfied hub areas (highest priority)
  //   - Belonging to a major/minor group still below its minimum
  //   - Lower prerequisite count (fewer additional courses needed)
  {
    const creditsSoFar = () =>
      [...assignments.keys()].reduce((s, id) => s + (courseInfo.get(id)?.credits ?? 4), 0);

    // Rebuild remaining hub needs for scoring
    const fillerHubRemaining = new Map<string, number>();
    for (const pool of hubPools) {
      fillerHubRemaining.set(pool.areaCode, pool.unitsStillNeeded);
    }
    for (const id of assignments.keys()) {
      const areas = courseMissingHubAreas.get(id);
      if (!areas) continue;
      for (const areaCode of areas) {
        const rem = fillerHubRemaining.get(areaCode);
        if (rem !== undefined && rem > 0) fillerHubRemaining.set(areaCode, rem - 1);
      }
    }

    // Compute which major groups are still below minimum
    const groupDeficits = new Map<string, number>();
    for (const grp of majorGroups) {
      const grpIds = new Set([...grp.required, ...grp.electives].map((c) => c.id));
      const placed = [...assignments.keys()].filter((id) => grpIds.has(id)).length;
      const deficit = Math.max(0, grp.stillNeeded - placed);
      if (deficit > 0) {
        for (const c of [...grp.required, ...grp.electives]) {
          groupDeficits.set(`${grp.programCode}:${grp.groupName}:${c.id}`, deficit);
        }
      }
    }

    function fillerScore(c: CourseNode): number {
      let score = 0;
      // Hub coverage: +10 per unsatisfied area this course covers
      const areas = courseMissingHubAreas.get(c.id);
      if (areas) {
        for (const areaCode of areas) {
          if ((fillerHubRemaining.get(areaCode) ?? 0) > 0) score += 10;
        }
      }
      // Major group deficit: +5 if this course belongs to a deficit group
      for (const [key] of groupDeficits) {
        if (key.endsWith(`:${c.id}`)) { score += 5; break; }
      }
      // Fewer prereqs = better: -1 per prereq
      score -= c.prereqIds.filter((pid) => !doneIds.has(pid) && !assignments.has(pid)).length;
      return score;
    }

    if (creditsSoFar() < creditTarget) {
      const available = fillerCourses
        .filter((c) => !assignments.has(c.id) && !doneIds.has(c.id));
      // Sort by score descending, then apply rotation
      available.sort((a, b) => fillerScore(b) - fillerScore(a));
      const rotated = rotate(available, cfg.hRot);

      for (const course of rotated) {
        if (creditsSoFar() >= creditTarget) break;
        for (const pid of course.prereqIds) {
          if (!doneIds.has(pid) && !assignments.has(pid) && courseInfo.has(pid)) tryAssign(pid);
        }
        tryAssign(course.id);
      }
    }

    // Recovery — if still below target, retry with relaxed constraints
    if (creditsSoFar() < creditTarget) {
      const available2 = fillerCourses
        .filter((c) => !assignments.has(c.id) && !doneIds.has(c.id));
      available2.sort((a, b) => fillerScore(b) - fillerScore(a));
      const rotated2 = rotate(available2, cfg.hRot);

      for (const course of rotated2) {
        if (creditsSoFar() >= creditTarget) break;
        for (const pid of course.prereqIds) {
          if (!doneIds.has(pid) && !assignments.has(pid) && courseInfo.has(pid)) {
            tryAssignRelaxed(pid);
          }
        }
        tryAssignRelaxed(course.id);
      }
    }
  }

  // ── Earliest-finish detection ─────────────────────────────────────────────
  let earliestFinish: string | null = null;
  for (const sem of assignments.values()) {
    if (!earliestFinish || semOrd(sem) > semOrd(earliestFinish)) earliestFinish = sem;
  }

  // ── Build result ──────────────────────────────────────────────────────────
  const assignments_arr = [...assignments.entries()].map(([id, sem]) => {
    const node = courseInfo.get(id)!;
    return { courseId: id, code: node.code, title: node.title, credits: node.credits, semester: sem, pinned: pinnedMap.has(id) };
  });

  return { assignments: assignments_arr, earliestFinish };
}

// ── Plan Validation ──────────────────────────────────────────────────────────

function validatePlan(
  ctx: PlanContext,
  assignments: GeneratedAssignment[],
  opts: GenerateOptions,
): PlanValidation {
  const missing: string[] = [];
  const {
    hubPools, majorGroups, creditTarget, courseInfo, doneIds,
    courseMissingHubAreas, programCodes, doneEntries, doneCodes,
  } = ctx;
  const effectiveMax = opts.maxCoursesPerSem ?? 4;
  const majorCap = opts.majorCoursesPerSem ?? 2;

  // 1. Hub areas satisfied
  const hubRemaining = new Map<string, number>();
  for (const pool of hubPools) {
    hubRemaining.set(pool.areaCode, pool.unitsStillNeeded);
  }
  for (const a of assignments) {
    const areas = courseMissingHubAreas.get(a.courseId);
    if (!areas) continue;
    for (const areaCode of areas) {
      const rem = hubRemaining.get(areaCode);
      if (rem !== undefined && rem > 0) hubRemaining.set(areaCode, rem - 1);
    }
  }
  for (const [area, rem] of hubRemaining) {
    if (rem > 0) missing.push(`Hub area ${area}: ${rem} unit(s) still needed`);
  }

  // 2. Major/minor group minimums
  const assignedIds = new Set(assignments.map((a) => a.courseId));
  for (const grp of majorGroups) {
    const grpIds = new Set([...grp.required, ...grp.electives].map((c) => c.id));
    const placed = [...assignedIds].filter((id) => grpIds.has(id)).length;
    const deficit = grp.stillNeeded - placed;
    if (deficit > 0) {
      missing.push(`${grp.programCode} / ${grp.groupName}: ${deficit} more course(s) needed`);
    }
    // Check all required courses are placed
    for (const c of grp.required) {
      if (!assignedIds.has(c.id) && !doneIds.has(c.id)) {
        missing.push(`${grp.programCode}: required course ${c.code} not placed`);
      }
    }
  }

  // 3. Credit target
  const totalCredits = assignments.reduce((s, a) => s + a.credits, 0);
  if (totalCredits < creditTarget) {
    missing.push(`Credits: ${totalCredits} placed, need ${creditTarget}`);
  }

  // 4. Prerequisite ordering
  const assignmentMap = new Map(assignments.map((a) => [a.courseId, a.semester]));
  for (const a of assignments) {
    const node = courseInfo.get(a.courseId);
    if (!node) continue;
    for (const pid of node.prereqIds) {
      if (doneIds.has(pid)) continue;
      const prereqSem = assignmentMap.get(pid);
      if (!prereqSem) {
        missing.push(`Prereq: ${node.code} needs unplaced prereq ${courseInfo.get(pid)?.code ?? pid}`);
      } else if (semOrd(prereqSem) >= semOrd(a.semester)) {
        missing.push(`Prereq order: ${courseInfo.get(pid)?.code ?? pid} must come before ${node.code}`);
      }
    }
  }

  // 5. Per-semester load caps
  const semCounts = new Map<string, number>();
  for (const a of assignments) {
    semCounts.set(a.semester, (semCounts.get(a.semester) ?? 0) + 1);
  }
  for (const [sem, count] of semCounts) {
    const existing = ctx.existingLoad.get(sem) ?? 0;
    const cap = sem.startsWith("Summer") ? Math.min(2, effectiveMax) : effectiveMax;
    if (count + existing > cap) {
      missing.push(`Semester ${sem}: ${count + existing} courses exceeds cap ${cap}`);
    }
  }

  // 6. School-specific requirements
  // Build course entries including planned courses for validation
  const plannedEntries: CourseEntry[] = assignments.map((a) => {
    const node = courseInfo.get(a.courseId);
    const code = node?.code ?? a.code;
    // Extract department from code (format: "SCHOOL DEPT NUM" or "DEPT NUM")
    const parts = code.trim().split(/\s+/);
    const dept = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
    return {
      course: { code, title: a.title, department: dept, credits: a.credits },
      status: "completed" as const, // treat planned as completed for validation
    };
  });
  const allEntries = [...doneEntries, ...plannedEntries];

  for (const progCode of programCodes) {
    const reqs = computeProgramSchoolRequirements(progCode, allEntries);
    for (const r of reqs) {
      if (!r.satisfied && !r.inProgress) {
        missing.push(`School req (${progCode}): ${r.name} not satisfied`);
      }
    }
  }

  return { valid: missing.length === 0, missing };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateAllPlans(
  userId: string,
  pinnedCourses: { courseId: number; semester: string }[],
  endSemesterOverride?: string,
  opts: GenerateOptions = {},
): Promise<GeneratePlanResult[]> {
  const ctx = await fetchPlanContext(userId, pinnedCourses, endSemesterOverride);

  // Run all 10 base variants
  const results: GeneratePlanResult[] = [];
  for (let i = 0; i < VARIANTS.length; i++) {
    const cfg = VARIANTS[i];
    const { assignments, earliestFinish } = runVariant(ctx, cfg, opts);
    const validation = validatePlan(ctx, assignments, opts);
    results.push({ variantIndex: i, name: cfg.name, assignments, earliestFinish, validation });
  }

  // Separate valid and invalid plans
  const valid = results.filter((r) => r.validation.valid);
  const invalid = results.filter((r) => !r.validation.valid);

  // If we already have 10 valid, return them
  if (valid.length >= 10) return valid.slice(0, 10);

  // Try to recover invalid plans by re-running with shuffled elective orders
  // Cap total retry attempts at 20 (30 total including the 10 originals)
  let retryAttempts = 0;
  const MAX_RETRIES = 20;

  for (const failedPlan of invalid) {
    if (valid.length >= 10 || retryAttempts >= MAX_RETRIES) break;

    const baseCfg = VARIANTS[failedPlan.variantIndex];

    // Try different rotation combinations
    const rotations: [0 | 1 | 2, 0 | 1 | 2][] = [
      [1, 2], [2, 1], [0, 2], [2, 0], [1, 0], [0, 1],
    ];

    for (const [hRot, mRot] of rotations) {
      if (valid.length >= 10 || retryAttempts >= MAX_RETRIES) break;
      // Skip if this is the same as the original
      if (hRot === baseCfg.hRot && mRot === baseCfg.mRot) continue;

      retryAttempts++;
      const retryCfg: VariantConfig = { ...baseCfg, hRot, mRot };
      const { assignments, earliestFinish } = runVariant(ctx, retryCfg, opts);
      const validation = validatePlan(ctx, assignments, opts);

      if (validation.valid) {
        valid.push({
          variantIndex: failedPlan.variantIndex,
          name: `${baseCfg.name} (alt)`,
          assignments,
          earliestFinish,
          validation,
        });
        break; // Move to next failed variant
      }
    }
  }

  // Return valid plans first, then invalid ones to fill remaining slots
  // (so we always return some results even if not all are valid)
  const combined = [...valid];
  for (const r of invalid) {
    if (combined.length >= 10) break;
    // Only add invalid if we don't have a valid alt for this variant already
    if (!valid.some((v) => v.variantIndex === r.variantIndex)) {
      combined.push(r);
    }
  }

  return combined.slice(0, 10);
}

export { VARIANTS };
