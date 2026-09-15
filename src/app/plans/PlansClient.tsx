"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CAPACITY_COLORS } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CourseSection {
  term: string;
  days: string;
  startTime: string;
  endTime: string;
}

interface ScenarioCourse {
  courseId: number;
  code: string;
  title: string;
  credits: number;
  semester: string;
  pinned: boolean;
  hubAreas: { code: string; name: string }[];
  prereqs: { courseId: number; code: string }[];
  sections: CourseSection[];
}

interface Scenario {
  id: number;
  name: string;
  createdAt: string;
  favourited: boolean;
  courses: ScenarioCourse[];
  earliestFinish?: string | null;
}

interface ExistingCourse {
  courseId: number;
  code: string;
  title: string;
  credits: number;
  semester: string;
  status: "completed" | "in-progress";
}

interface BaseProgress {
  totalCreditsEarned: number;
  totalCreditsInProgress: number;
  totalCreditsRequired: number;
  gpa: number;
  hubUnitsFulfilled: number;
  hubUnitsTotal: number;
  hubCapacities: {
    capacity: string;
    unitsFulfilled: number;
    unitsRequired: number;
    areas: {
      code: string;
      name: string;
      unitsFulfilled: number;
      unitsRequired: number;
      contributingCourses: { code: string; title: string; semester: string; grade: string }[];
    }[];
  }[];
  programs: {
    name: string;
    isActive: boolean;
    type: string;
    totalCompleted: number;
    totalRequired: number;
    groups: {
      groupName: string;
      description: string;
      minCourses: number;
      completedCount: number;
      inProgressCount: number;
      plannedCount: number;
      courses: { code: string; title: string | null; status: string | null; isRequired: boolean }[];
    }[];
  }[];
}

interface PlansClientProps {
  initialScenarios: Scenario[];
  existingCourses: ExistingCourse[];
  profileEndSemester?: string;
  baseProgress?: BaseProgress;
}

// ── Semester helpers ──────────────────────────────────────────────────────────

function semOrd(s: string): number {
  const [term, yearStr] = s.trim().split(" ");
  const year = parseInt(yearStr) || 0;
  if (term === "Fall")   return year * 3;
  if (term === "Spring") return (year - 1) * 3 + 1;
  if (term === "Summer") return (year - 1) * 3 + 2;
  return year * 3;
}

function generateSemesterOptions(): string[] {
  const sems: string[] = [];
  const now = new Date();
  for (let y = now.getFullYear(); y <= now.getFullYear() + 6; y++) {
    sems.push(`Fall ${y}`, `Spring ${y + 1}`, `Summer ${y + 1}`);
  }
  return sems;
}

// ── Hub area colours ──────────────────────────────────────────────────────────
const HUB_COLORS: Record<string, string> = {
  PHI: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  SCI: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  SOC: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  QR:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  DIV: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  CIV: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  COM: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  WIC: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  ITK: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
};
function hubColor(code: string) {
  return HUB_COLORS[code.replace(/\d/g, "")] ?? "bg-gray-100 text-gray-600";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlansClient({
  initialScenarios,
  existingCourses,
  profileEndSemester,
  baseProgress,
}: PlansClientProps) {
  const router = useRouter();

  // ── State ─────────────────────────────────────────────────────────────────
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenarios);
  const [activeId, setActiveId]   = useState<number | null>(initialScenarios[0]?.id ?? null);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying]     = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [showOverview, setShowOverview] = useState(true);
  const [hideSatisfied, setHideSatisfied] = useState(false);

  // Generate options
  const [preference, setPreference]               = useState<"hub" | "major" | "balanced">("balanced");
  const [endSemOverride, setEndSemOverride]         = useState(profileEndSemester ?? "");
  const [maxCoursesPerSem, setMaxCoursesPerSem]   = useState<3 | 4 | 5>(4);
  const [majorCoursesPerSem, setMajorCoursesPerSem] = useState<0 | 2 | 3>(2);

  // Resizable left sidebar
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const dragState = useRef<{ startX: number; startW: number } | null>(null);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startW: sidebarWidth };

    function onMove(ev: MouseEvent) {
      if (!dragState.current) return;
      const delta = ev.clientX - dragState.current.startX;
      setSidebarWidth(Math.max(180, Math.min(420, dragState.current.startW + delta)));
    }
    function onUp() {
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  const editRef = useRef<HTMLInputElement>(null);

  const activeScenario = scenarios.find((s) => s.id === activeId) ?? null;
  const pinnedCount    = activeScenario?.courses.filter((c) => c.pinned).length ?? 0;

  // ── Arrow navigation ──────────────────────────────────────────────────────
  const activeIndex = scenarios.findIndex((s) => s.id === activeId);
  function goPrev() { if (activeIndex > 0) setActiveId(scenarios[activeIndex - 1].id); }
  function goNext() { if (activeIndex < scenarios.length - 1) setActiveId(scenarios[activeIndex + 1].id); }

  // ── Projected stats (base + scenario) ────────────────────────────────────
  const scenarioCredits = useMemo(
    () => (activeScenario?.courses ?? []).reduce((s, c) => s + c.credits, 0),
    [activeScenario],
  );

  const projectedHubCapacities = useMemo(() => {
    if (!baseProgress) return [];
    const sc = activeScenario?.courses ?? [];
    return baseProgress.hubCapacities.map((cap) => {
      const areas = cap.areas.map((area) => {
        const fromScenario = sc
          .filter((c) => c.hubAreas.some((ha) => ha.code === area.code))
          .map((c) => ({ code: c.code, title: c.title, semester: c.semester, grade: "" }));
        const all = [...area.contributingCourses, ...fromScenario];
        const unitsFulfilled = Math.min(all.length, area.unitsRequired);
        return { ...area, contributingCourses: all, unitsFulfilled };
      });
      return { ...cap, areas, unitsFulfilled: areas.reduce((s, a) => s + a.unitsFulfilled, 0) };
    });
  }, [baseProgress, activeScenario]);

  const projectedHubFulfilled = projectedHubCapacities.reduce((s, c) => s + c.unitsFulfilled, 0);

  const programCoverage = useMemo(() => {
    if (!baseProgress) return [];
    const scenarioCodes = new Set((activeScenario?.courses ?? []).map((c) => c.code));
    const scenarioCourseMap = new Map((activeScenario?.courses ?? []).map((c) => [c.code, c]));
    // Build a set of all group course codes per program for cross-matching scenario courses
    return baseProgress.programs.filter((p) => p.isActive && p.groups.length > 0).map((p) => {
      // Collect ALL course codes across ALL groups in this program (for detecting scenario courses
      // that satisfy a group even if placed for a different program)
      const allProgramCodes = new Set(p.groups.flatMap((g) => g.courses.map((c) => c.code)));

      return {
        name: p.name,
        type: p.type,
        totalCompleted: p.totalCompleted,
        totalRequired: p.totalRequired,
        groups: p.groups.map((g) => {
          const groupCodes = new Set(g.courses.map((c) => c.code));

          // Courses from the scenario that match this group's course list
          const scenarioMatches = g.courses.filter(
            (c) => scenarioCodes.has(c.code) && c.status !== "completed" && c.status !== "in-progress"
          );

          // Also find scenario courses NOT in g.courses but that could plausibly satisfy this group.
          // This handles dynamic elective groups where progress.ts discovered a different set of
          // eligible courses than what the plan generator placed, and cases where the scenario course
          // was placed for another program but also satisfies this group's requirements.
          const extraScenarioMatches: { code: string; title: string; semester: string }[] = [];
          if (g.courses.length === 0 || (g.minCourses > 0 && g.courses.every((c) => !c.isRequired))) {
            // This is an elective-style group — check if any scenario course could fit
            for (const [code, sc] of scenarioCourseMap) {
              if (groupCodes.has(code)) continue; // already counted in scenarioMatches
              // For empty groups (dynamic electives): any scenario course in the same department
              // and 300+ level qualifies. Check by comparing department prefix.
              if (g.courses.length === 0) {
                // Infer department from other groups' courses
                const otherDepts = new Set<string>();
                for (const gc of allProgramCodes) {
                  const match = gc.match(/^CAS\s+(\w+)\s+/);
                  if (match) otherDepts.add(match[1]);
                }
                const codeMatch = code.match(/^CAS\s+(\w+)\s+(\d+)/);
                if (codeMatch && otherDepts.has(codeMatch[1]) && parseInt(codeMatch[2]) >= 300) {
                  // Don't double-count courses already in another group of this program
                  let inOtherGroup = false;
                  for (const og of p.groups) {
                    if (og.groupName === g.groupName) continue;
                    if (og.courses.some((c) => c.code === code)) { inOtherGroup = true; break; }
                  }
                  if (!inOtherGroup) {
                    extraScenarioMatches.push({ code, title: sc.title, semester: sc.semester });
                  }
                }
              }
            }
          }

          const scenarioCount = scenarioMatches.length + extraScenarioMatches.length;

          // Required courses that aren't completed, in-progress, or anywhere in the scenario
          const missingRequired = g.courses
            .filter(
              (c) =>
                c.isRequired &&
                c.status !== "completed" &&
                c.status !== "in-progress" &&
                !scenarioCodes.has(c.code)
            )
            .map((c) => c.code);
          const projected = g.completedCount + g.inProgressCount + g.plannedCount + scenarioCount;

          // Build detailed course lists for display
          const completedCourses = g.courses
            .filter((c) => c.status === "completed")
            .map((c) => ({ code: c.code, title: c.title ?? c.code }));
          const inProgressCourses = g.courses
            .filter((c) => c.status === "in-progress")
            .map((c) => ({ code: c.code, title: c.title ?? c.code }));
          const plannedCourses = g.courses
            .filter((c) => c.status === "planned")
            .map((c) => ({ code: c.code, title: c.title ?? c.code }));
          const scenarioCourseDetails = [
            ...scenarioMatches.map((c) => {
              const sc = scenarioCourseMap.get(c.code);
              return { code: c.code, title: sc?.title ?? c.title ?? c.code, semester: sc?.semester ?? "" };
            }),
            ...extraScenarioMatches,
          ];

          return {
            groupName: g.groupName,
            description: g.description,
            minCourses: g.minCourses,
            completedCount: g.completedCount,
            inProgressCount: g.inProgressCount,
            plannedCount: g.plannedCount,
            scenarioCount,
            projected,
            missingRequired,
            completedCourses,
            inProgressCourses,
            plannedCourses,
            scenarioCourseDetails,
            /** True only when both the count threshold AND all required courses are covered. */
            satisfied: projected >= g.minCourses && missingRequired.length === 0,
          };
        }),
      };
    });
  }, [baseProgress, activeScenario]);

  // ── Prerequisite violation check ──────────────────────────────────────────
  // For each scenario course, verify every prereq is either completed/in-progress
  // (existingCourses) or placed in a strictly earlier semester in the scenario.
  const prereqViolations = useMemo(() => {
    if (!activeScenario) return [] as { course: string; prereq: string }[];
    const completedIds = new Set(existingCourses.map((c) => c.courseId));
    const semByCourseId = new Map<number, string>();
    for (const c of activeScenario.courses) semByCourseId.set(c.courseId, c.semester);

    const violations: { course: string; prereq: string }[] = [];
    for (const c of activeScenario.courses) {
      for (const p of (c.prereqs ?? [])) {
        if (completedIds.has(p.courseId)) continue; // prereq already done
        const prereqSem = semByCourseId.get(p.courseId);
        if (!prereqSem) {
          violations.push({ course: c.code, prereq: p.code }); // prereq not in plan at all
        } else if (semOrd(prereqSem) >= semOrd(c.semester)) {
          violations.push({ course: c.code, prereq: p.code }); // prereq placed too late
        }
      }
    }
    return violations;
  }, [activeScenario, existingCourses]);

  // ── Schedule conflict detection ───────────────────────────────────────────
  const scheduleStatus = useMemo(() => {
    if (!activeScenario) return { conflicts: [] as { semester: string; course1: string; course2: string; detail: string }[], unknownCount: 0 };

    function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); }
    function daysIntersect(d1: string, d2: string) {
      const s = new Set(d1.split(",").map((d) => d.trim()));
      return d2.split(",").some((d) => s.has(d.trim()));
    }
    function overlap(a: CourseSection, b: CourseSection) {
      if (!daysIntersect(a.days, b.days)) return false;
      return toMin(a.startTime) < toMin(b.endTime) && toMin(b.startTime) < toMin(a.endTime);
    }
    function canCoexist(secsA: CourseSection[], secsB: CourseSection[], term: string) {
      const a = secsA.filter((s) => s.term === term);
      const b = secsB.filter((s) => s.term === term);
      if (a.length === 0 || b.length === 0) return true; // no data → assume OK
      for (const sa of a) for (const sb of b) if (!overlap(sa, sb)) return true;
      return false;
    }

    const conflicts: { semester: string; course1: string; course2: string; detail: string }[] = [];
    let unknownCount = 0;

    const bySemester = new Map<string, ScenarioCourse[]>();
    for (const c of activeScenario.courses) {
      if (!bySemester.has(c.semester)) bySemester.set(c.semester, []);
      bySemester.get(c.semester)!.push(c);
    }

    for (const [sem, courses] of bySemester) {
      const term = sem.split(" ")[0];
      for (const c of courses) {
        if (!(c.sections ?? []).some((s) => s.term === term)) unknownCount++;
      }
      for (let i = 0; i < courses.length; i++) {
        for (let j = i + 1; j < courses.length; j++) {
          const a = courses[i], b = courses[j];
          const secsA = a.sections ?? [], secsB = b.sections ?? [];
          const hasDataA = secsA.some((s) => s.term === term);
          const hasDataB = secsB.some((s) => s.term === term);
          if (!hasDataA || !hasDataB) continue; // can't verify
          if (!canCoexist(secsA, secsB, term)) {
            const sa = secsA.find((s) => s.term === term)!;
            const sb = secsB.find((s) => s.term === term)!;
            conflicts.push({
              semester: sem,
              course1: a.code,
              course2: b.code,
              detail: `${sa.days} ${sa.startTime}–${sa.endTime}  vs  ${sb.days} ${sb.startTime}–${sb.endTime}`,
            });
          }
        }
      }
    }
    return { conflicts, unknownCount };
  }, [activeScenario]);

  // Maps courseCode → list of codes it definitively conflicts with
  const conflictMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of scheduleStatus.conflicts) {
      if (!map.has(c.course1)) map.set(c.course1, []);
      if (!map.has(c.course2)) map.set(c.course2, []);
      map.get(c.course1)!.push(c.course2);
      map.get(c.course2)!.push(c.course1);
    }
    return map;
  }, [scheduleStatus]);

  // ── Plan validation summary ────────────────────────────────────────────────
  const planValidation = useMemo(() => {
    if (!baseProgress || !activeScenario) return null;

    const hubIssueCount = projectedHubCapacities
      .flatMap((cap) => cap.areas.filter((a) => a.unitsFulfilled < a.unitsRequired))
      .length;

    const majorPrograms = programCoverage.filter(
      (p) => p.type === "major" || p.type === "joint-major",
    );
    const minorPrograms = programCoverage.filter((p) => p.type === "minor");

    const majorIssueCount = majorPrograms.flatMap((p) => p.groups.filter((g) => !g.satisfied)).length;
    const minorIssueCount = minorPrograms.flatMap((p) => p.groups.filter((g) => !g.satisfied)).length;

    return {
      hubOK:      hubIssueCount === 0,
      hubIssues:  hubIssueCount,
      majorOK:    majorPrograms.length > 0 && majorIssueCount === 0,
      majorIssues: majorIssueCount,
      hasMajor:   majorPrograms.length > 0,
      minorOK:    minorPrograms.length > 0 && minorIssueCount === 0,
      minorIssues: minorIssueCount,
      hasMinor:   minorPrograms.length > 0,
      prereqsOK:  prereqViolations.length === 0,
      prereqIssues: prereqViolations.length,
      scheduleOK:      scheduleStatus.conflicts.length === 0,
      scheduleConflicts: scheduleStatus.conflicts.length,
      scheduleUnknown:   scheduleStatus.unknownCount,
    };
  }, [baseProgress, activeScenario, projectedHubCapacities, programCoverage, prereqViolations, scheduleStatus]);

  // ── Semester grid ─────────────────────────────────────────────────────────
  const { semesterMap, allSemesters } = useMemo(() => {
    const map = new Map<string, { scenario: ScenarioCourse[]; existing: ExistingCourse[] }>();

    for (const c of existingCourses) {
      if (!c.semester) continue;
      if (!map.has(c.semester)) map.set(c.semester, { scenario: [], existing: [] });
      map.get(c.semester)!.existing.push(c);
    }
    if (activeScenario) {
      for (const c of activeScenario.courses) {
        if (!map.has(c.semester)) map.set(c.semester, { scenario: [], existing: [] });
        map.get(c.semester)!.scenario.push(c);
      }
    }
    const sorted = [...map.keys()].sort((a, b) => semOrd(a) - semOrd(b));
    return { semesterMap: map, allSemesters: sorted };
  }, [activeScenario, existingCourses]);

  // Summary stats
  const stats = useMemo(() => {
    if (!activeScenario) return null;
    const existCr  = existingCourses.reduce((s, c) => s + c.credits, 0);
    const planCr   = activeScenario.courses.reduce((s, c) => s + c.credits, 0);
    const hubCodes = new Set(activeScenario.courses.flatMap((c) => c.hubAreas.map((h) => h.code)));
    return { existCr, planCr, total: existCr + planCr, hubCodes, pinnedCount };
  }, [activeScenario, existingCourses, pinnedCount]);

  // Earliest finish = last semester in the active scenario
  const earliestFinish = useMemo(() => {
    if (!activeScenario || activeScenario.courses.length === 0) return null;
    return activeScenario.courses.reduce(
      (latest, c) => (semOrd(c.semester) > semOrd(latest) ? c.semester : latest),
      activeScenario.courses[0].semester,
    );
  }, [activeScenario]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function createPlan() {
    const name = newName.trim() || `Plan ${scenarios.length + 1}`;
    const res = await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const created: Scenario = await res.json();
    setScenarios((prev) => [created, ...prev]);
    setActiveId(created.id);
    setCreatingNew(false);
    setNewName("");
  }

  async function renamePlan(id: number, name: string) {
    await fetch(`/api/scenarios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    setEditingId(null);
  }

  function deletePlan(id: number) {
    // Optimistic: remove from UI immediately so there's no delay.
    const remaining = scenarios.filter((s) => s.id !== id);
    setScenarios(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id ?? null);
    // Fire-and-forget API call; failure is silent (stale entry is harmless).
    fetch(`/api/scenarios/${id}`, { method: "DELETE" }).catch(console.error);
  }

  async function toggleFavourite(id: number, favourited: boolean) {
    // Optimistic update
    setScenarios((prev) => prev.map((s) => s.id === id ? { ...s, favourited } : s));
    await fetch(`/api/scenarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favourited }),
    }).catch(console.error);
  }

  async function handleGenerate() {
    const pinnedCourses = activeScenario?.courses
      .filter((c) => c.pinned)
      .map((c) => ({ courseId: c.courseId, semester: c.semester })) ?? [];

    setGenerating(true);
    setShowGenPanel(false);
    try {
      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pinnedCourses,
          preference,
          endSemesterOverride: endSemOverride || undefined,
          maxCoursesPerSem,
          majorCoursesPerSem,
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const { scenarios: newScenarios }: { scenarios: Scenario[] } = await res.json();
      setScenarios((prev) => [...newScenarios, ...prev]);
      setActiveId(newScenarios[0]?.id ?? activeId);
    } catch (e) {
      console.error(e);
      alert("Could not generate plans. Make sure your programs and Hub requirements are set up.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApply() {
    if (!activeId) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/scenarios/${activeId}/apply`, { method: "POST" });
      if (!res.ok) throw new Error("Apply failed");
      router.push("/planner");
    } finally {
      setApplying(false);
    }
  }

  async function togglePin(courseId: number, pinned: boolean) {
    if (!activeId) return;
    setScenarios((prev) =>
      prev.map((s) =>
        s.id !== activeId ? s
          : { ...s, courses: s.courses.map((c) => (c.courseId === courseId ? { ...c, pinned } : c)) }
      )
    );
    await fetch(`/api/scenarios/${activeId}/courses`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, pinned }),
    });
  }

  async function removeCourse(courseId: number) {
    if (!activeId) return;
    setScenarios((prev) =>
      prev.map((s) =>
        s.id !== activeId ? s : { ...s, courses: s.courses.filter((c) => c.courseId !== courseId) }
      )
    );
    await fetch(`/api/scenarios/${activeId}/courses?courseId=${courseId}`, { method: "DELETE" });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const semOptions = useMemo(generateSemesterOptions, []);

  return (
    <div className="flex h-full select-none">

      {/* ── Left sidebar — resizable ──────────────────────────────────────── */}
      <aside
        style={{ width: sidebarWidth, minWidth: sidebarWidth }}
        className="shrink-0 border-r border-card-border bg-card flex flex-col overflow-hidden"
      >

        {/* Generate panel toggle */}
        <div className="p-3 border-b border-card-border space-y-2">
          <button
            onClick={() => setShowGenPanel((v) => !v)}
            disabled={generating}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent/90 disabled:opacity-60 transition-colors"
          >
            <span className="flex items-center gap-2">
              {generating ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              )}
              {generating ? "Generating…" : "Generate 10 Plans"}
            </span>
            {!generating && (
              <svg className={`w-3.5 h-3.5 transition-transform ${showGenPanel ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            )}
          </button>

          {/* Generate options panel */}
          {showGenPanel && (
            <div className="rounded-md border border-card-border bg-background p-3 space-y-3 text-xs">
              {pinnedCount > 0 && (
                <p className="text-info font-medium">
                  {pinnedCount} pinned course{pinnedCount !== 1 ? "s" : ""} will be kept in all variants.
                </p>
              )}

              {/* Priority preference */}
              <div>
                <p className="text-muted font-medium mb-1.5">Prioritize first:</p>
                <div className="flex gap-1">
                  {(["hub", "major", "balanced"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPreference(p)}
                      className={`flex-1 py-1 rounded text-center capitalize transition-colors ${
                        preference === p
                          ? "bg-accent text-white"
                          : "bg-card border border-card-border hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {p === "hub" ? "Hub" : p === "major" ? "Major" : "Both"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Course load */}
              <div>
                <p className="text-muted font-medium mb-1.5">Courses per semester:</p>
                <div className="flex gap-1">
                  {([3, 4, 5] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxCoursesPerSem(n)}
                      className={`flex-1 py-1 rounded text-center transition-colors ${
                        maxCoursesPerSem === n
                          ? "bg-accent text-white"
                          : "bg-card border border-card-border hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {n === 3 ? "Light" : n === 4 ? "Mod." : "Heavy"}
                      <span className="block text-[9px] opacity-70">{n} max</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Major intensity */}
              <div>
                <p className="text-muted font-medium mb-1.5">Major courses/semester:</p>
                <div className="flex gap-1">
                  {([2, 3, 0] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setMajorCoursesPerSem(n)}
                      className={`flex-1 py-1 rounded text-center transition-colors ${
                        majorCoursesPerSem === n
                          ? "bg-accent text-white"
                          : "bg-card border border-card-border hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {n === 0 ? "No limit" : n === 2 ? "Balanced" : "Intensive"}
                      {n > 0 && <span className="block text-[9px] opacity-70">{n} max</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* End semester override */}
              <div>
                <p className="text-muted font-medium mb-1.5">Plan until:</p>
                <select
                  value={endSemOverride}
                  onChange={(e) => setEndSemOverride(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-card-border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">Profile default</option>
                  {semOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full py-1.5 bg-accent text-white rounded-md font-medium hover:bg-accent/90 disabled:opacity-60 transition-colors"
              >
                Generate
              </button>
            </div>
          )}

          {/* New empty plan */}
          {creatingNew ? (
            <div className="flex gap-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createPlan();
                  if (e.key === "Escape") setCreatingNew(false);
                }}
                placeholder="Plan name…"
                className="flex-1 px-2 py-1 text-xs border border-card-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button onClick={createPlan} className="px-2 py-1 bg-accent text-white rounded-md text-xs">Save</button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingNew(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 border border-card-border rounded-md text-xs text-muted hover:text-foreground hover:border-accent/50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New blank plan
            </button>
          )}
        </div>

        {/* Scenario list */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {scenarios.length === 0 && (
            <p className="text-xs text-muted text-center py-6 px-2">
              No scenarios yet.<br />Click "Generate 10 Plans" to start.
            </p>
          )}
          {scenarios.map((s) => (
            <div
              key={s.id}
              className={`group rounded-md px-2 py-2 cursor-pointer transition-colors ${
                activeId === s.id
                  ? "bg-accent-light border border-accent/20"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              onClick={() => setActiveId(s.id)}
            >
              {editingId === s.id ? (
                <input
                  ref={editRef}
                  autoFocus
                  defaultValue={s.name}
                  onBlur={(e) => renamePlan(s.id, e.target.value || s.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renamePlan(s.id, (e.target as HTMLInputElement).value || s.name);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-full text-xs bg-transparent border-b border-accent outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${activeId === s.id ? "text-accent" : ""}`}>
                      {s.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted">
                        {s.courses.length} courses
                      </span>
                      {s.courses.some((c) => c.pinned) && (
                        <span className="text-[10px] text-info">
                          {s.courses.filter((c) => c.pinned).length} pinned
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex gap-0.5">
                    {/* Star: always visible when favourited, hover-visible otherwise */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavourite(s.id, !s.favourited); }}
                      className={`p-0.5 rounded transition-colors ${
                        s.favourited
                          ? "text-yellow-500 hover:text-yellow-600"
                          : "text-muted opacity-0 group-hover:opacity-100 hover:text-yellow-500"
                      }`}
                      title={s.favourited ? "Remove from favourites" : "Add to favourites"}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill={s.favourited ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(s.id); }}
                      className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Rename"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePlan(s.id); }}
                      className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Legend */}
        <div className="p-3 border-t border-card-border text-[10px] text-muted space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-success/20 border border-success/40 shrink-0" />Completed
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-warning/20 border border-warning/40 shrink-0" />In Progress
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-info/20 border border-info/40 shrink-0" />Planned (this scenario)
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-info shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25V9m7.5 0H8.25m7.5 0l1.5 10.5H6.75L8.25 9m7.5 0H8.25" />
            </svg>Pinned = locked when re-generating
          </div>
        </div>
      </aside>

      {/* Drag divider — visible grip handle */}
      <div
        onMouseDown={onDividerMouseDown}
        className="w-4 shrink-0 cursor-col-resize relative flex items-center justify-center group"
        title="Drag to resize"
      >
        {/* Vertical track line */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-card-border group-hover:bg-accent/50 active:bg-accent transition-colors" />
        {/* Grip knob */}
        <div className="relative z-10 flex flex-col gap-[3px] py-1 px-0.5 rounded bg-card border border-card-border group-hover:border-accent/50 group-hover:bg-accent/5 transition-colors shadow-sm">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-[3px]">
              <div className="w-[3px] h-[3px] rounded-full bg-muted/60 group-hover:bg-accent/70 transition-colors" />
              <div className="w-[3px] h-[3px] rounded-full bg-muted/60 group-hover:bg-accent/70 transition-colors" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!activeScenario ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <svg className="w-14 h-14 text-muted mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <p className="font-medium">No scenario selected</p>
              <p className="text-sm text-muted mt-1 max-w-xs">
                Click <strong>Generate 10 Plans</strong> to auto-build scenarios that satisfy all your Hub, major, and credit requirements.
              </p>
              <p className="text-xs text-muted mt-2">
                Pin courses you want to lock in, set a priority and graduation date, then regenerate to get tailored alternatives.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="px-4 py-2.5 border-b border-card-border flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                {/* Arrow navigation */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={goPrev}
                    disabled={activeIndex <= 0}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 transition-colors"
                    title="Previous scenario"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <span className="text-xs text-muted tabular-nums">{activeIndex + 1}/{scenarios.length}</span>
                  <button
                    onClick={goNext}
                    disabled={activeIndex >= scenarios.length - 1}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 transition-colors"
                    title="Next scenario"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
                <p className="font-semibold text-sm truncate max-w-xs">{activeScenario.name}</p>
                {stats && (
                  <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
                    <span>{stats.planCr} cr new</span>
                    <span className="text-card-border">|</span>
                    <span>{activeScenario.courses.length} courses planned</span>
                    {stats.pinnedCount > 0 && (
                      <>
                        <span className="text-card-border">|</span>
                        <span className="text-info">{stats.pinnedCount} pinned</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {pinnedCount > 0 && (
                  <button
                    onClick={() => { setShowGenPanel(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-info/40 text-info rounded-md text-xs font-medium hover:bg-info/10 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Re-generate with {pinnedCount} pin{pinnedCount !== 1 ? "s" : ""}
                  </button>
                )}
                <button
                  onClick={handleApply}
                  disabled={applying || activeScenario.courses.length === 0}
                  title="Merges new courses into your planner without overwriting existing ones"
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-success text-white rounded-md text-sm font-medium hover:bg-success/90 disabled:opacity-50 transition-colors"
                >
                  {applying ? "Merging…" : "Merge into Planner →"}
                </button>
              </div>
            </div>

            {/* Early-finish / minor suggestion banner */}
            {earliestFinish && (() => {
              const targetSem = endSemOverride || profileEndSemester;
              const isSemestersEarly = targetSem && semOrd(earliestFinish) < semOrd(targetSem);
              const totalProjectedCr = baseProgress
                ? baseProgress.totalCreditsEarned + baseProgress.totalCreditsInProgress + scenarioCredits
                : 0;
              const creditTarget = baseProgress?.totalCreditsRequired ?? 128;
              const hasSpare = totalProjectedCr > 0 && totalProjectedCr < creditTarget + 16;
              if (!isSemestersEarly && !hasSpare) return null;
              return (
                <div className="px-4 py-2 border-b border-card-border bg-success/5 flex flex-wrap items-start gap-2 text-xs">
                  {isSemestersEarly && (
                    <span className="text-success font-medium">
                      ✓ This plan finishes by <strong>{earliestFinish}</strong>
                      {targetSem ? ` — earlier than your target (${targetSem}).` : "."}
                    </span>
                  )}
                  {hasSpare && (
                    <span className="text-info">
                      You have spare capacity — consider adding a{" "}
                      <a href="/programs" className="underline hover:no-underline">minor</a> to fill remaining semesters.
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Scenario Overview (collapsible) */}
            {baseProgress && (
              <div className="border-b border-card-border bg-card shrink-0">
                <button
                  onClick={() => setShowOverview((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="font-semibold text-sm">Requirements Check</span>
                  {(() => {
                    const total = baseProgress.totalCreditsEarned + baseProgress.totalCreditsInProgress + scenarioCredits;
                    const creditOK  = total >= baseProgress.totalCreditsRequired;
                    const hubOK     = projectedHubFulfilled >= baseProgress.hubUnitsTotal;
                    const allProgOK = planValidation ? (planValidation.majorOK || !planValidation.hasMajor) && (planValidation.minorOK || !planValidation.hasMinor) : null;
                    const prereqOK  = planValidation?.prereqsOK ?? true;
                    const schedOK   = planValidation ? planValidation.scheduleConflicts === 0 : true;
                    return (
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <StatusDot ok={creditOK} label={`${total}/${baseProgress.totalCreditsRequired} cr`} />
                        <StatusDot ok={hubOK} label={`${projectedHubFulfilled}/${baseProgress.hubUnitsTotal} hub`} />
                        {allProgOK !== null && <StatusDot ok={allProgOK} label="Programs" />}
                        <StatusDot ok={prereqOK} label="Prereqs" />
                        {planValidation && <StatusDot ok={schedOK} label="Schedule" unknown={planValidation.scheduleConflicts === 0 && planValidation.scheduleUnknown > 0} />}
                        <svg className={`w-3 h-3 text-muted ml-1 transition-transform ${showOverview ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    );
                  })()}
                </button>

                {showOverview && (
                  <div className="px-4 pb-4 pt-3 border-t border-card-border overflow-y-auto max-h-[60vh]">

                    {/* ── Plan Validation + hide-satisfied toggle ─────────── */}
                    <div className="mb-4 flex items-start justify-between gap-3">
                      {planValidation && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${planValidation.hubOK ? "bg-success/10 text-success border-success/20" : "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"}`}>
                            {planValidation.hubOK ? "✓" : "✗"} Hub
                            {!planValidation.hubOK && <span className="opacity-70">· {planValidation.hubIssues} area{planValidation.hubIssues !== 1 ? "s" : ""} missing</span>}
                          </span>
                          {planValidation.hasMajor && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${planValidation.majorOK ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}`}>
                              {planValidation.majorOK ? "✓" : "⚠"} Major
                              {!planValidation.majorOK && <span className="opacity-70">· {planValidation.majorIssues} group{planValidation.majorIssues !== 1 ? "s" : ""} incomplete</span>}
                            </span>
                          )}
                          {planValidation.hasMinor && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${planValidation.minorOK ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}`}>
                              {planValidation.minorOK ? "✓" : "⚠"} Minor
                              {!planValidation.minorOK && <span className="opacity-70">· {planValidation.minorIssues} group{planValidation.minorIssues !== 1 ? "s" : ""} incomplete</span>}
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${planValidation.prereqsOK ? "bg-success/10 text-success border-success/20" : "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"}`}>
                            {planValidation.prereqsOK ? "✓" : "✗"} Prereqs
                            {!planValidation.prereqsOK && <span className="opacity-70">· {planValidation.prereqIssues} issue{planValidation.prereqIssues !== 1 ? "s" : ""}</span>}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            planValidation.scheduleConflicts > 0
                              ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                              : planValidation.scheduleUnknown > 0
                              ? "bg-gray-100 text-muted border-card-border"
                              : "bg-success/10 text-success border-success/20"
                          }`}>
                            {planValidation.scheduleConflicts > 0 ? "✗" : planValidation.scheduleUnknown > 0 ? "?" : "✓"} Schedule
                            {planValidation.scheduleConflicts > 0 && <span className="opacity-70">· {planValidation.scheduleConflicts} conflict{planValidation.scheduleConflicts !== 1 ? "s" : ""}</span>}
                            {planValidation.scheduleConflicts === 0 && planValidation.scheduleUnknown > 0 && <span className="opacity-70">· {planValidation.scheduleUnknown} unknown</span>}
                          </span>
                        </div>
                      )}
                      {/* Hide satisfied toggle */}
                      <button
                        onClick={() => setHideSatisfied((v) => !v)}
                        className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                          hideSatisfied
                            ? "bg-accent text-white border-accent"
                            : "bg-card border-card-border text-muted hover:border-accent/40 hover:text-foreground"
                        }`}
                        title={hideSatisfied ? "Show all requirements" : "Hide satisfied requirements"}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          {hideSatisfied
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          }
                        </svg>
                        {hideSatisfied ? "Show all" : "Hide satisfied"}
                      </button>
                    </div>

                    {/* ── Program requirement coverage ─────────────────────── */}
                    {programCoverage.length > 0 && (
                      <div className="mb-3 space-y-3">
                        <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">Program Requirements</p>
                        {[
                          ...programCoverage.filter((p) => p.type === "major" || p.type === "joint-major"),
                          ...programCoverage.filter((p) => p.type !== "major" && p.type !== "joint-major"),
                        ].map((prog) => {
                          const totalProjected = prog.groups.reduce((s, g) => s + Math.min(g.projected, g.minCourses), 0);
                          const pct = Math.min((totalProjected / Math.max(prog.totalRequired, 1)) * 100, 100);
                          const allGroupsSatisfied = prog.groups.length > 0 && prog.groups.every((g) => g.satisfied);
                          const visibleGroups = hideSatisfied ? prog.groups.filter((g) => !g.satisfied) : prog.groups;
                          const hiddenGroupCount = prog.groups.length - visibleGroups.length;
                          return (
                          <div key={prog.name} className="rounded-lg border border-card-border overflow-hidden">
                            {/* Program header with overall progress */}
                            <div className={`px-3 py-2.5 ${allGroupsSatisfied ? "bg-success/5" : "bg-gray-50 dark:bg-gray-800/40"}`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                                    prog.type === "major" || prog.type === "joint-major"
                                      ? "bg-accent/15 text-accent"
                                      : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                  }`}>
                                    {prog.type === "joint-major" ? "joint major" : prog.type}
                                  </span>
                                  <p className="text-xs font-semibold truncate">{prog.name}</p>
                                </div>
                                <span className={`text-[11px] font-semibold shrink-0 ml-2 ${allGroupsSatisfied ? "text-success" : "text-muted"}`}>
                                  {allGroupsSatisfied ? "✓ Complete" : `${totalProjected}/${prog.totalRequired}`}
                                </span>
                              </div>
                              {/* Overall progress bar */}
                              <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${allGroupsSatisfied ? "bg-success" : "bg-accent"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-muted mt-0.5">
                                <span>{prog.totalCompleted} completed</span>
                                <span>{Math.round(pct)}%</span>
                              </div>
                            </div>

                            {/* Group breakdown */}
                            {visibleGroups.length > 0 && (
                              <div className="divide-y divide-card-border">
                                {visibleGroups.map((g) => (
                                  <div key={g.groupName} className="px-3 py-2">
                                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                                      <span className="truncate pr-2 text-foreground font-medium">{g.groupName}</span>
                                      <span className={`shrink-0 font-semibold tabular-nums ${
                                        g.satisfied ? "text-success" : g.projected > 0 ? "text-info" : "text-muted"
                                      }`}>
                                        {g.satisfied ? "✓" : `${g.projected}/${g.minCourses}`}
                                        {!g.satisfied && g.scenarioCount > 0 && (
                                          <span className="text-info font-normal"> (+{g.scenarioCount} new)</span>
                                        )}
                                      </span>
                                    </div>
                                    {g.description && (
                                      <p className="text-[9px] text-muted mb-1 leading-tight">{g.description}</p>
                                    )}
                                    {/* Segmented progress bar */}
                                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                      <div className="flex h-full rounded-full overflow-hidden">
                                        {g.completedCount > 0 && (
                                          <div className="h-full bg-success" style={{ width: `${Math.min((g.completedCount / g.minCourses) * 100, 100)}%` }} />
                                        )}
                                        {g.inProgressCount > 0 && (
                                          <div className="h-full bg-warning" style={{ width: `${Math.min((g.inProgressCount / g.minCourses) * 100, 100)}%` }} />
                                        )}
                                        {g.plannedCount > 0 && (
                                          <div className="h-full bg-purple-400" style={{ width: `${Math.min((g.plannedCount / g.minCourses) * 100, 100)}%` }} />
                                        )}
                                        {g.scenarioCount > 0 && (
                                          <div className="h-full bg-info" style={{ width: `${Math.min((g.scenarioCount / g.minCourses) * 100, 100)}%` }} />
                                        )}
                                      </div>
                                    </div>
                                    {/* Course details — shows exactly which courses satisfy this group */}
                                    {(g.completedCourses.length > 0 || g.inProgressCourses.length > 0 || g.plannedCourses.length > 0 || g.scenarioCourseDetails.length > 0) && (
                                      <div className="mt-1.5 space-y-0.5">
                                        {g.completedCourses.map((c) => (
                                          <div key={c.code} className="flex items-center gap-1.5 text-[9px]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                                            <span className="font-mono font-medium text-success">{c.code}</span>
                                            <span className="text-muted truncate">{c.title}</span>
                                          </div>
                                        ))}
                                        {g.inProgressCourses.map((c) => (
                                          <div key={c.code} className="flex items-center gap-1.5 text-[9px]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                                            <span className="font-mono font-medium text-warning">{c.code}</span>
                                            <span className="text-muted truncate">{c.title}</span>
                                          </div>
                                        ))}
                                        {g.plannedCourses.map((c) => (
                                          <div key={c.code} className="flex items-center gap-1.5 text-[9px]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                                            <span className="font-mono font-medium text-purple-500 dark:text-purple-400">{c.code}</span>
                                            <span className="text-muted truncate">{c.title}</span>
                                          </div>
                                        ))}
                                        {g.scenarioCourseDetails.map((c) => (
                                          <div key={c.code} className="flex items-center gap-1.5 text-[9px]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-info shrink-0" />
                                            <span className="font-mono font-medium text-info">{c.code}</span>
                                            <span className="text-muted truncate">{c.title}</span>
                                            {c.semester && <span className="text-muted/60 shrink-0">{c.semester}</span>}
                                          </div>
                                        ))}
                                        {g.projected < g.minCourses && (
                                          <div className="flex items-center gap-1.5 text-[9px] text-red-400">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                            {g.minCourses - g.projected} more course{g.minCourses - g.projected !== 1 ? "s" : ""} needed
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {/* Missing required courses */}
                                    {g.missingRequired.length > 0 && (
                                      <div className="mt-1.5 flex flex-wrap gap-1">
                                        {g.missingRequired.map((code) => (
                                          <span key={code} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" title="Required — not in plan">
                                            ✗ {code}
                                          </span>
                                        ))}
                                        <span className="text-[9px] text-red-500 self-center italic">required, not in plan</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Hidden satisfied count */}
                            {hiddenGroupCount > 0 && (
                              <div className="px-3 py-1.5 border-t border-card-border bg-success/5 text-[9px] text-success">
                                {hiddenGroupCount} satisfied group{hiddenGroupCount !== 1 ? "s" : ""} hidden
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Hub capacities ──────────────────────────────────── */}
                    {(() => {
                      const visibleCaps = hideSatisfied
                        ? projectedHubCapacities.filter((c) => c.unitsFulfilled < c.unitsRequired)
                        : projectedHubCapacities;
                      const hiddenCapCount = projectedHubCapacities.length - visibleCaps.length;
                      return (
                        <div className="space-y-2 mb-3">
                          <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">Hub Capacities</p>
                          {visibleCaps.map((cap) => {
                            const capColor = CAPACITY_COLORS[cap.capacity] ?? "#6b7280";
                            const baseCap = baseProgress.hubCapacities.find((c) => c.capacity === cap.capacity);
                            const capSatisfied = cap.unitsFulfilled >= cap.unitsRequired;
                            return (
                              <div key={cap.capacity} className="rounded-md border border-card-border overflow-hidden">
                                <div className="px-3 py-1.5 flex items-center justify-between" style={{ borderLeft: `3px solid ${capColor}` }}>
                                  <span className="text-xs font-medium truncate pr-2" title={cap.capacity}>{cap.capacity}</span>
                                  <span className={`text-xs shrink-0 font-medium ${capSatisfied ? "text-success" : "text-muted"}`}>
                                    {cap.unitsFulfilled}/{cap.unitsRequired}
                                    {capSatisfied && " ✓"}
                                  </span>
                                </div>
                                <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-gray-50 dark:bg-gray-800/30">
                                  {cap.areas.map((area) => {
                                    const baseArea = baseCap?.areas.find((a) => a.code === area.code);
                                    const wasAlready = (baseArea?.unitsFulfilled ?? 0) >= area.unitsRequired;
                                    const nowDone = area.unitsFulfilled >= area.unitsRequired;
                                    const newlyDone = !wasAlready && nowDone;
                                    return (
                                      <span
                                        key={area.code}
                                        title={`${area.name}${!nowDone ? " — still needed" : ""}`}
                                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                          wasAlready
                                            ? "bg-success/10 text-success border border-success/20"
                                            : newlyDone
                                            ? "bg-info/10 text-info border border-info/30"
                                            : "bg-red-50 text-red-500 border border-red-200 dark:bg-red-900/20 dark:text-red-400"
                                        }`}
                                      >
                                        {wasAlready ? "✓" : newlyDone ? "+" : "○"} {area.code}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          {hiddenCapCount > 0 && (
                            <div className="px-3 py-1.5 rounded-md border border-success/20 bg-success/5 text-[9px] text-success">
                              {hiddenCapCount} satisfied hub capacit{hiddenCapCount !== 1 ? "ies" : "y"} hidden
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Credits / GPA stat boxes ─────────────────────────── */}
                    {(() => {
                      const total = baseProgress.totalCreditsEarned + baseProgress.totalCreditsInProgress + scenarioCredits;
                      return (
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-accent">
                              {total}<span className="text-xs font-normal text-muted">/{baseProgress.totalCreditsRequired}</span>
                            </p>
                            <p className="text-xs font-medium mt-0.5">Credits</p>
                            <p className="text-[10px] text-muted">{baseProgress.totalCreditsEarned} earned{baseProgress.totalCreditsInProgress > 0 ? ` · ${baseProgress.totalCreditsInProgress} in prog.` : ""}</p>
                            {scenarioCredits > 0 && <p className="text-[10px] text-info">+{scenarioCredits} this scenario</p>}
                            <div className="mt-1.5 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min((total / baseProgress.totalCreditsRequired) * 100, 100)}%` }} />
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-info">
                              {projectedHubFulfilled}<span className="text-xs font-normal text-muted">/{baseProgress.hubUnitsTotal}</span>
                            </p>
                            <p className="text-xs font-medium mt-0.5">Hub Units</p>
                            {projectedHubFulfilled > baseProgress.hubUnitsFulfilled
                              ? <p className="text-[10px] text-muted">{baseProgress.hubUnitsFulfilled} earned · +{projectedHubFulfilled - baseProgress.hubUnitsFulfilled} new</p>
                              : <p className="text-[10px] text-muted">{baseProgress.hubUnitsTotal - baseProgress.hubUnitsFulfilled} remaining</p>}
                            <div className="mt-1.5 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-info rounded-full" style={{ width: `${Math.min((projectedHubFulfilled / baseProgress.hubUnitsTotal) * 100, 100)}%` }} />
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-success">{baseProgress.gpa.toFixed(2)}</p>
                            <p className="text-xs font-medium mt-0.5">GPA</p>
                            <p className="text-[10px] text-muted">from completed courses</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Prerequisites ────────────────────────────────────── */}
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1.5">Prerequisites</p>
                      {prereqViolations.length === 0 ? (
                        !hideSatisfied && (
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-success/20 bg-success/5 text-xs text-success">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            All prerequisite chains respected
                          </div>
                        )
                      ) : (
                        <div className="rounded-md border border-red-200 dark:border-red-800 overflow-hidden">
                          <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-[10px] font-medium text-red-600 dark:text-red-400">
                            {prereqViolations.length} prerequisite issue{prereqViolations.length !== 1 ? "s" : ""} found
                          </div>
                          <div className="divide-y divide-red-100 dark:divide-red-900/30">
                            {prereqViolations.map((v, i) => (
                              <div key={i} className="px-3 py-1.5 text-[10px] flex items-center gap-1.5">
                                <span className="font-mono font-semibold text-foreground">{v.course}</span>
                                <span className="text-muted">needs</span>
                                <span className="font-mono font-semibold text-red-600 dark:text-red-400">{v.prereq}</span>
                                <span className="text-muted">(not yet placed before it)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Schedule conflicts ───────────────────────────────── */}
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1.5">Schedule</p>
                      {scheduleStatus.conflicts.length === 0 && scheduleStatus.unknownCount === 0 && !hideSatisfied && (
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-success/20 bg-success/5 text-xs text-success">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          No time conflicts detected
                        </div>
                      )}
                      {scheduleStatus.conflicts.length > 0 && (
                        <div className="rounded-md border border-red-200 dark:border-red-800 overflow-hidden mb-2">
                          <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-[10px] font-medium text-red-600 dark:text-red-400">
                            {scheduleStatus.conflicts.length} time conflict{scheduleStatus.conflicts.length !== 1 ? "s" : ""} — these courses cannot both be taken in the same semester
                          </div>
                          <div className="divide-y divide-red-100 dark:divide-red-900/30">
                            {scheduleStatus.conflicts.map((c, i) => (
                              <div key={i} className="px-3 py-1.5 text-[10px]">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="font-mono font-semibold text-foreground">{c.course1}</span>
                                  <span className="text-muted">↔</span>
                                  <span className="font-mono font-semibold text-red-600 dark:text-red-400">{c.course2}</span>
                                  <span className="text-muted shrink-0">in {c.semester}</span>
                                </div>
                                <p className="text-muted pl-0 font-mono">{c.detail}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {scheduleStatus.unknownCount > 0 && (
                        <div className="flex items-start gap-1.5 px-3 py-2 rounded-md border border-card-border bg-gray-50 dark:bg-gray-800/30 text-[10px] text-muted">
                          <span className="text-warning shrink-0 font-bold">?</span>
                          <span>
                            <strong>{scheduleStatus.unknownCount} course{scheduleStatus.unknownCount !== 1 ? "s" : ""}</strong> have no historical schedule data — time conflicts cannot be verified.
                          </span>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* Semester columns — same visual pattern as the planner */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
              <div className="flex gap-4 min-w-max">
                {allSemesters.length === 0 ? (
                  <p className="text-sm text-muted">This scenario has no courses yet.</p>
                ) : (
                  allSemesters.map((sem) => {
                    const { scenario: sc, existing: ex } = semesterMap.get(sem) ?? { scenario: [], existing: [] };
                    const totalCr = [...sc, ...ex].reduce((s, c) => s + c.credits, 0);
                    const load = ex.length + sc.length;

                    return (
                      <div key={sem} className="w-52 shrink-0">
                        {/* Header */}
                        <div className="mb-2 px-0.5">
                          <div className="flex items-baseline justify-between">
                            <p className="text-xs font-semibold">{sem}</p>
                            <p className="text-[10px] text-muted">{totalCr} cr</p>
                          </div>
                          {/* Load bar */}
                          <div className="mt-1 h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${load >= 5 ? "bg-warning" : "bg-accent"}`}
                              style={{ width: `${Math.min((load / 5) * 100, 100)}%` }}
                            />
                          </div>
                          <p className="text-[9px] text-muted mt-0.5">{load}/5 courses</p>
                        </div>

                        <div className="space-y-1.5">
                          {/* Existing courses (completed / in-progress) */}
                          {ex.map((c) => (
                            <div
                              key={c.courseId}
                              className={`rounded-md px-2.5 py-2 border text-xs ${
                                c.status === "completed"
                                  ? "bg-success/10 border-success/20"
                                  : "bg-warning/10 border-warning/20"
                              }`}
                            >
                              <p className="font-mono font-semibold text-[11px] opacity-70">{c.code}</p>
                              <p className="truncate mt-0.5 opacity-60 text-[11px]">{c.title}</p>
                              <p className="mt-0.5 text-[10px] opacity-50">{c.credits} cr · {c.status}</p>
                            </div>
                          ))}

                          {/* Scenario courses */}
                          {sc.map((c) => (
                            <ScenarioCourseCard
                              key={c.courseId}
                              course={c}
                              onPin={(pinned) => togglePin(c.courseId, pinned)}
                              onRemove={() => removeCourse(c.courseId)}
                              conflictsWith={conflictMap.get(c.code) ?? []}
                              noScheduleData={!(c.sections ?? []).some((s) => s.term === sem.split(" ")[0])}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatusDot({ ok, label, unknown }: { ok: boolean; label: string; unknown?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
      unknown ? "text-muted" : ok ? "text-success" : "text-red-500 dark:text-red-400"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        unknown ? "bg-muted/50" : ok ? "bg-success" : "bg-red-500"
      }`} />
      {label}
    </span>
  );
}

// ── Scenario course card ──────────────────────────────────────────────────────

function ScenarioCourseCard({
  course,
  onPin,
  onRemove,
  conflictsWith = [],
  noScheduleData = false,
}: {
  course: ScenarioCourse;
  onPin: (pinned: boolean) => void;
  onRemove: () => void;
  conflictsWith?: string[];
  noScheduleData?: boolean;
}) {
  const hasConflict = conflictsWith.length > 0;
  return (
    <div
      className={`group relative rounded-md px-2.5 py-2 border text-xs transition-colors ${
        hasConflict
          ? "bg-red-50 border-red-300 dark:bg-red-900/15 dark:border-red-700"
          : course.pinned
          ? "bg-info/10 border-info/40"
          : "bg-card border-card-border hover:border-accent/30"
      }`}
    >
      {/* Conflict / unknown-schedule badge */}
      {hasConflict && (
        <div
          className="absolute top-1.5 left-1.5 flex items-center gap-0.5 text-red-500"
          title={`Time conflict with: ${conflictsWith.join(", ")}`}
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-.53 14.03a.75.75 0 001.06 0l3.25-3.25a.75.75 0 10-1.06-1.06L12 14.69l-2.72-2.72a.75.75 0 00-1.06 1.06l3.25 3.25zM12 9.75a.75.75 0 000-1.5.75.75 0 000 1.5z" />
          </svg>
        </div>
      )}
      {!hasConflict && noScheduleData && (
        <div
          className="absolute top-1.5 left-1.5 text-muted/50"
          title="No schedule data — time conflicts cannot be verified"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 01-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.454 1.272 1.454 3.326 0 4.598-.43.377-.902.602-1.378.733V12.75a.75.75 0 01-1.5 0V12a.75.75 0 01.75-.75h.001c.38-.001.777-.144 1.14-.463.545-.476.545-1.251 0-1.704zM12 16.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      {/* Action icons */}
      <div className="absolute top-1.5 right-1.5 flex gap-0.5">
        <button
          onClick={() => onPin(!course.pinned)}
          title={course.pinned ? "Unpin (allow re-generation to change)" : "Pin to this semester"}
          className={`p-0.5 rounded transition-colors ${
            course.pinned ? "text-info" : "text-muted opacity-0 group-hover:opacity-100 hover:text-info"
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"
            fill={course.pinned ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25V9m7.5 0H8.25m7.5 0l1.5 10.5H6.75L8.25 9m7.5 0H8.25" />
          </svg>
        </button>
        <button
          onClick={onRemove}
          title="Remove from scenario"
          className="p-0.5 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-red-500 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className={`font-mono font-semibold text-[11px] pr-10 ${hasConflict || noScheduleData ? "pl-4" : ""} ${hasConflict ? "text-red-500" : "text-muted"}`}>{course.code}</p>
      <p className="font-medium text-[12px] pr-10 mt-0.5 leading-tight" title={course.title}>
        {course.title.length > 42 ? course.title.slice(0, 40) + "…" : course.title}
      </p>
      <p className="mt-1 text-muted text-[10px]">{course.credits} credits</p>

      {course.hubAreas.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {course.hubAreas.map((h) => (
            <span
              key={h.code}
              className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${hubColor(h.code)}`}
              title={h.name}
            >
              {h.code}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
