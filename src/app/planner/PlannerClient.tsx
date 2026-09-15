"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { CAPACITY_COLORS } from "@/lib/constants";

interface PlannerCourse {
  id: number;
  code: string;
  title: string;
  credits: number;
  slug: string;
  status: string | null;
  semester: string | null;
  grade: string | null;
  hubAreas: { code: string; name: string }[];
  prereqs: { code: string; groupId: number; groupType: string }[];
  offeredTerms: string[]; // e.g. ["Fall", "Spring"] derived from schedule history
  sections: { term: string; days: string; startTime: string; endTime: string }[];
}

interface HubArea {
  code: string;
  name: string;
  unitsFulfilled: number;
  unitsRequired: number;
  contributingCourses: { code: string; title: string; semester: string; grade: string; isPlanned?: boolean }[];
}

interface HubCapacity {
  capacity: string;
  unitsFulfilled: number;
  unitsRequired: number;
  areas: HubArea[];
}

interface PlannerProgress {
  totalCreditsEarned: number;
  totalCreditsInProgress: number;
  totalCreditsPlanned: number;
  totalCreditsRequired: number;
  gpa: number;
  hubUnitsFulfilled: number;
  hubUnitsTotal: number;
  hubCapacities: HubCapacity[];
  missingHubAreas: {
    code: string;
    name: string;
    capacity: string;
    unitsRequired: number;
    unitsFulfilled: number;
    unitsStillNeeded: number;
    suggestedCourses: { code: string; title: string; credits: number; slug: string }[];
  }[];
  degreeType: string;
  inProgressCourses: { id: number; code: string; title: string; semester: string; department: string }[];
  doubleCountedCodes: string[];
  programs: {
    id: number;
    name: string;
    isActive: boolean;
    type: string;
    totalCompleted: number;
    totalRequired: number;
    schoolRequirements: { id: string; name: string; satisfied: boolean; inProgress: boolean; current: string; target: string }[];
    groups: {
      groupName: string;
      description: string;
      minCourses: number;
      completedCount: number;
      inProgressCount: number;
      plannedCount: number;
      courses: {
        code: string;
        title: string | null;
        isRequired: boolean;
        status: string | null;
        grade: string | null;
        semester: string | null;
        slug: string | null;
      }[];
    }[];
  }[];
}

// ── Semester helpers ──────────────────────────────────────────────────────────

// Academic year order: Fall Y → Spring Y+1 → Summer Y+1 → Fall Y+1 → …
function semesterOrder(s: string): number {
  const parts = s.trim().split(" ");
  const year = parseInt(parts[parts.length - 1]) || 0;
  const term = parts[0];
  if (term === "Fall")   return year * 3;
  if (term === "Spring") return (year - 1) * 3 + 1;
  if (term === "Summer") return (year - 1) * 3 + 2;
  return year * 3;
}

function generateSemesters(startSemester: string, endSemester: string): string[] {
  const list: string[] = [];
  const startOrd = semesterOrder(startSemester);
  const endOrd   = semesterOrder(endSemester);
  const startYear = parseInt(startSemester.split(" ").pop() ?? "2025");
  const endYear   = parseInt(endSemester.split(" ").pop()   ?? "2029");

  for (let y = startYear - 1; y <= endYear + 1; y++) {
    for (const sem of [`Fall ${y}`, `Spring ${y + 1}`, `Summer ${y + 1}`]) {
      const ord = semesterOrder(sem);
      if (ord >= startOrd && ord <= endOrd) list.push(sem);
    }
  }
  return list;
}

// ── Schedule conflict helpers ─────────────────────────────────────────────────

interface Slot { days: string; startTime: string; endTime: string }

/** True if two scheduled time slots overlap (shared day AND overlapping time). */
function slotsOverlap(a: Slot, b: Slot): boolean {
  if (!a.days || !b.days || !a.startTime || !b.startTime) return false;
  const aDays = new Set(a.days.split(",").map((d) => d.trim()));
  const sharedDay = b.days.split(",").some((d) => aDays.has(d.trim()));
  if (!sharedDay) return false;
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

/**
 * Cartesian product of arrays.
 * e.g. cartesian([[A1,A2],[B1]]) = [[A1,B1],[A2,B1]]
 */
function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap((combo) => arr.map((item) => [...combo, item])),
    [[]]
  );
}

const SHORT_SCHOOL = /^(?:CAS|ENG|QST|COM|SAR|SHA|SPH|SSW|STH|MET|CFA|CGS|WED|LAW|GRS|CDS)\s+/;

// ── Mini components ───────────────────────────────────────────────────────────

function MiniBar({ value, max, color = "bg-info" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Add-course search panel ───────────────────────────────────────────────────

function AddCoursePanel({ onAdd, existingIds }: { onAdd: (c: PlannerCourse) => void; existingIds: Set<number> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlannerCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetch(
          `/api/courses/search?q=${encodeURIComponent(query)}`
        ).then((r) => r.json());
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  function handleAdd(course: PlannerCourse) {
    if (existingIds.has(course.id)) return;
    onAdd({ ...course, status: "planned", semester: null });
    setQuery("");
    setResults([]);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          placeholder="Search to add a course…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full px-2 py-1 text-xs border border-card-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {loading && (
          <span className="text-xs text-muted shrink-0">…</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-card-border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.map((c) => {
            const alreadyIn = existingIds.has(c.id);
            return (
              <button
                key={c.id}
                onMouseDown={() => handleAdd(c)}
                disabled={alreadyIn}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between gap-2 ${
                  alreadyIn ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <span>
                  <span className="font-semibold">{c.code}</span>
                  <span className="text-muted ml-1 truncate">{c.title}</span>
                </span>
                <span className="shrink-0 text-muted">
                  {alreadyIn ? "in planner" : `${c.credits}cr`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Semester picker ───────────────────────────────────────────────────────────

function SemesterPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value.trim().split(" ");
  const term = parts[0] ?? "Fall";
  const year = parseInt(parts[parts.length - 1] ?? "2025");
  const years = Array.from({ length: 16 }, (_, i) => 2020 + i); // 2020–2035

  function update(t: string, y: number) { onChange(`${t} ${y}`); }

  return (
    <div className="flex items-center gap-1">
      <select
        value={term}
        onChange={(e) => update(e.target.value, year)}
        className="text-xs border border-card-border rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option>Fall</option>
        <option>Spring</option>
        <option>Summer</option>
      </select>
      <select
        value={year}
        onChange={(e) => update(term, parseInt(e.target.value))}
        className="text-xs border border-card-border rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

// ── Progress panel ────────────────────────────────────────────────────────────

function ProgressPanel({
  progress,
  plannedCredits,
  projectedHubCapacities,
  projectedHubFulfilled,
  placedCodes,
}: {
  progress: PlannerProgress;
  plannedCredits: number;
  projectedHubCapacities: HubCapacity[];
  projectedHubFulfilled: number;
  placedCodes: Set<string>;
}) {
  const [openCapacity, setOpenCapacity] = useState<string | null>(null);
  const [hideSatisfiedHubs, setHideSatisfiedHubs] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [hideSatisfiedGroups, setHideSatisfiedGroups] = useState(false);

  const activePrograms = progress.programs.filter((p) => p.isActive);

  const suggestedByAreaCode = useMemo(
    () => new Map(progress.missingHubAreas.map((m) => [m.code, m.suggestedCourses])),
    [progress.missingHubAreas],
  );

  const totalCreditsDisplayed = progress.totalCreditsEarned + progress.totalCreditsInProgress + plannedCredits;

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleCapacities = hideSatisfiedHubs
    ? projectedHubCapacities.filter((cap) => cap.unitsFulfilled < cap.unitsRequired)
    : projectedHubCapacities;

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-accent">
            {totalCreditsDisplayed}
            <span className="text-sm font-normal text-muted">/{progress.totalCreditsRequired}</span>
          </p>
          <p className="text-xs font-medium mt-0.5">Credits</p>
          <p className="text-[10px] text-muted">{progress.totalCreditsEarned} earned</p>
          {progress.totalCreditsInProgress > 0 && (
            <p className="text-[10px] text-muted">{progress.totalCreditsInProgress} in progress</p>
          )}
          {plannedCredits > 0 && (
            <p className="text-[10px] text-muted">{plannedCredits} planned</p>
          )}
          <MiniBar value={totalCreditsDisplayed} max={progress.totalCreditsRequired} color="bg-accent" />
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-info">
            {projectedHubFulfilled}
            <span className="text-sm font-normal text-muted">/{progress.hubUnitsTotal}</span>
          </p>
          <p className="text-xs font-medium mt-0.5">Hub Units</p>
          {projectedHubFulfilled > progress.hubUnitsFulfilled ? (
            <p className="text-[10px] text-muted">
              {progress.hubUnitsFulfilled} earned + {projectedHubFulfilled - progress.hubUnitsFulfilled} planned
            </p>
          ) : (
            <p className="text-[10px] text-muted">{progress.hubUnitsTotal - progress.hubUnitsFulfilled} remaining</p>
          )}
          <MiniBar value={projectedHubFulfilled} max={progress.hubUnitsTotal} color="bg-info" />
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-success">{progress.gpa.toFixed(2)}</p>
          <p className="text-xs font-medium mt-0.5">GPA</p>
          <p className="text-[10px] text-muted">4.0 scale</p>
          <MiniBar value={progress.gpa} max={4.0} color="bg-success" />
        </div>
      </div>

      {/* Per-program school requirements */}
      {progress.programs
        .filter((p) => p.isActive && p.schoolRequirements.length > 0)
        .map((prog) => (
          <div key={prog.id}>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              {prog.name} Requirements
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {prog.schoolRequirements.map((req) => (
                <div key={req.id} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                    req.satisfied
                      ? "bg-success text-white"
                      : req.inProgress
                      ? "bg-warning text-white"
                      : "bg-gray-200 text-muted"
                  }`}>
                    {req.satisfied ? (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : req.inProgress ? (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3 3" />
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                    ) : (
                      <span className="text-[8px] leading-none">–</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{req.name}</p>
                    <p className="text-[10px] text-muted">{req.current}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      }

      {/* Hub Requirements */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">Hub Requirements</h3>
          <button
            onClick={() => setHideSatisfiedHubs((v) => !v)}
            className="text-[10px] text-info hover:underline shrink-0"
          >
            {hideSatisfiedHubs ? "Show all" : "Hide satisfied"}
          </button>
        </div>
        <div className="space-y-2">
          {visibleCapacities.map((cap) => {
            const isOpen = openCapacity === cap.capacity;
            const capPct = cap.unitsRequired > 0 ? (cap.unitsFulfilled / cap.unitsRequired) * 100 : 0;
            const allDone = cap.unitsFulfilled >= cap.unitsRequired;
            return (
              <div key={cap.capacity} className="border border-card-border rounded-md overflow-hidden">
                <button
                  onClick={() => setOpenCapacity(isOpen ? null : cap.capacity)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: allDone ? "#16a34a" : (CAPACITY_COLORS[cap.capacity] ?? "#6b7280") }}
                  />
                  <span
                    className="text-xs font-medium flex-1 truncate"
                    style={{ color: allDone ? undefined : (CAPACITY_COLORS[cap.capacity] ?? undefined) }}
                  >
                    {cap.capacity}
                  </span>
                  <span className={`text-[10px] font-semibold shrink-0 ${allDone ? "text-success" : capPct > 0 ? "text-warning" : "text-muted"}`}>
                    {Math.round(capPct)}%
                  </span>
                  <span className="text-[10px] text-muted shrink-0">{isOpen ? "▲" : "▼"}</span>
                </button>
                <div className="px-3 pb-1">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${cap.unitsRequired > 0 ? Math.min((cap.unitsFulfilled / cap.unitsRequired) * 100, 100) : 0}%`,
                        backgroundColor: allDone ? "#16a34a" : (CAPACITY_COLORS[cap.capacity] ?? "#6b7280"),
                      }}
                    />
                  </div>
                </div>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {cap.areas.map((area) => {
                      const fulfilled = area.unitsFulfilled >= area.unitsRequired;
                      const suggested = suggestedByAreaCode.get(area.code) ?? [];
                      return (
                        <div
                          key={area.code}
                          className={`rounded p-2 text-xs ${fulfilled ? "bg-success-light" : "bg-accent-light"}`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`font-bold ${fulfilled ? "text-success" : "text-accent"}`}>{area.code}</span>
                            <span className={`text-[10px] ${fulfilled ? "text-success" : "text-accent"}`}>
                              {area.unitsFulfilled}/{area.unitsRequired}
                            </span>
                          </div>
                          <p className={fulfilled ? "text-success" : "text-foreground"}>{area.name}</p>
                          {area.contributingCourses.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {area.contributingCourses.map((c) => (
                                <span
                                  key={c.code}
                                  className={`text-[10px] px-1 py-0.5 rounded ${
                                    c.isPlanned
                                      ? "bg-info-light text-info border border-info/20"
                                      : "bg-white/60"
                                  }`}
                                >
                                  {c.code}{c.isPlanned ? " (→)" : c.grade ? ` (${c.grade})` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                          {!fulfilled && suggested.length > 0 && (
                            <div className="mt-1.5 pt-1 border-t border-accent/20">
                              <p className="text-[9px] text-accent font-medium mb-0.5">Could satisfy</p>
                              <div className="flex flex-wrap gap-0.5">
                                {suggested.slice(0, 5).map((sc) => (
                                  <Link
                                    key={sc.code}
                                    href={`/courses/${sc.slug}`}
                                    className="text-[9px] bg-white/60 px-1 py-0.5 rounded hover:underline"
                                  >
                                    {sc.code}
                                  </Link>
                                ))}
                                {suggested.length > 5 && (
                                  <span className="text-[9px] text-muted">+{suggested.length - 5} more</span>
                                )}
                              </div>
                            </div>
                          )}
                          {!fulfilled && (
                            <p className="text-[10px] text-accent mt-1">
                              {area.unitsRequired - area.unitsFulfilled} more unit
                              {area.unitsRequired - area.unitsFulfilled !== 1 ? "s" : ""} needed
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active programs */}
      {activePrograms.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">Active Programs</h3>
            <button
              onClick={() => setHideSatisfiedGroups((v) => !v)}
              className="text-[10px] text-info hover:underline shrink-0"
            >
              {hideSatisfiedGroups ? "Show all" : "Hide satisfied"}
            </button>
          </div>
          <div className="space-y-3">
            {activePrograms.map((prog) => {
              // Projected total counts placed-planned courses toward requirements
              const projectedTotal = prog.groups.reduce((sum, g) => {
                const grpCourses = g.courses ?? [];
                const placed = grpCourses.filter(
                  (c) => c.status === "planned" && placedCodes.has(c.code)
                ).length;
                return sum + Math.min(g.completedCount + g.inProgressCount + placed, g.minCourses);
              }, 0);

              const visibleGroups = hideSatisfiedGroups
                ? prog.groups.filter((g) => {
                    const grpCourses = g.courses ?? [];
                    const placed = grpCourses.filter(
                      (c) => c.status === "planned" && placedCodes.has(c.code)
                    ).length;
                    return (g.completedCount + g.inProgressCount + placed) < g.minCourses;
                  })
                : prog.groups;

              return (
                <div key={prog.id}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold truncate">{prog.name}</p>
                    <span className="text-[10px] text-muted shrink-0">
                      {projectedTotal}/{prog.totalRequired}
                    </span>
                  </div>
                  <MiniBar value={projectedTotal} max={prog.totalRequired} color="bg-accent" />
                  <div className="space-y-1 mt-1.5">
                    {visibleGroups.map((g) => {
                      const courses = g.courses ?? [];
                      const placedPlannedInGroup = courses.filter(
                        (c) => c.status === "planned" && placedCodes.has(c.code)
                      ).length;
                      const trackedCount = g.completedCount + g.inProgressCount + placedPlannedInGroup;
                      const done = trackedCount >= g.minCourses;
                      const groupKey = `${prog.id}-${g.groupName}`;
                      const isGroupOpen = openGroups.has(groupKey);
                      // satisfying: completed, in-progress, or placed planned
                      const satisfying = courses.filter(
                        (c) =>
                          c.status === "completed" ||
                          c.status === "in-progress" ||
                          (c.status === "planned" && placedCodes.has(c.code))
                      );
                      // couldSatisfy: not tracked, OR planned but sitting in unplanned pool
                      const couldSatisfy = courses.filter(
                        (c) => c.status === null || (c.status === "planned" && !placedCodes.has(c.code))
                      );
                      return (
                        <div key={g.groupName} className="border border-card-border rounded-md overflow-hidden">
                          <button
                            onClick={() => toggleGroup(groupKey)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-50 transition-colors"
                          >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              done ? "bg-success text-white" : "bg-accent-light text-accent"
                            }`}>
                              {g.groupName.length <= 2 ? g.groupName : g.groupName[0]}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] truncate">{g.description}</p>
                              <MiniBar value={trackedCount} max={g.minCourses} color={done ? "bg-success" : "bg-accent"} />
                            </div>
                            <span className="text-[10px] text-muted shrink-0">{trackedCount}/{g.minCourses}</span>
                            <span className="text-[10px] text-muted">{isGroupOpen ? "▲" : "▼"}</span>
                          </button>
                          {isGroupOpen && (
                            <div className="px-2 pb-2 pt-1 border-t border-card-border space-y-1">
                              {satisfying.length > 0 && (
                                <div className="space-y-0.5">
                                  {satisfying.map((c) => (
                                    <div
                                      key={c.code}
                                      className={`flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded ${
                                        c.status === "completed"
                                          ? "bg-success-light text-success"
                                          : c.status === "in-progress"
                                          ? "bg-warning-light text-warning"
                                          : "bg-info-light text-info"
                                      }`}
                                    >
                                      <span className="font-medium">
                                        {c.slug ? (
                                          <Link href={`/courses/${c.slug}`} className="hover:underline">
                                            {c.code}
                                          </Link>
                                        ) : (
                                          c.code
                                        )}
                                      </span>
                                      <span>
                                        {c.grade || (c.status === "in-progress" ? "IP" : c.status === "planned" ? "Planned" : "")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!done && couldSatisfy.length > 0 && (
                                <div className={satisfying.length > 0 ? "pt-1 border-t border-card-border" : ""}>
                                  <p className="text-[9px] text-muted font-medium mb-0.5">Could satisfy</p>
                                  <div className="flex flex-wrap gap-0.5">
                                    {couldSatisfy.slice(0, 8).map((c) =>
                                      c.slug ? (
                                        <Link
                                          key={c.code}
                                          href={`/courses/${c.slug}`}
                                          className="text-[9px] bg-gray-100 hover:bg-gray-200 px-1 py-0.5 rounded inline-block"
                                        >
                                          {c.code}
                                        </Link>
                                      ) : (
                                        <span key={c.code} className="text-[9px] bg-gray-100 px-1 py-0.5 rounded">
                                          {c.code}
                                        </span>
                                      )
                                    )}
                                    {couldSatisfy.length > 8 && (
                                      <span className="text-[9px] text-muted self-center">
                                        +{couldSatisfy.length - 8} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              {satisfying.length === 0 && couldSatisfy.length === 0 && (
                                <p className="text-[10px] text-muted py-0.5">No specific courses listed.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main planner component ────────────────────────────────────────────────────

export default function PlannerClient({
  courses,
  progress,
}: {
  courses: PlannerCourse[];
  progress: PlannerProgress;
}) {
  const [draggedCourse, setDraggedCourse] = useState<PlannerCourse | null>(null);
  // Extra courses added from search during this session
  const [locallyAdded, setLocallyAdded] = useState<PlannerCourse[]>([]);
  // Courses removed this session (so server-loaded courses can be hidden client-side)
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [startSemester, setStartSemester] = useState("Fall 2025");
  const [endSemester, setEndSemester] = useState("Spring 2029");
  const [showPanel, setShowPanel] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; msg?: string }>({ type: "idle" });
  const importInputRef = useRef<HTMLInputElement>(null);

  // ── Save tracking ──────────────────────────────────────────────────────────
  type PendingSave =
    | { type: "upsert"; courseId: number; status: string; semester: string }
    | { type: "delete"; courseId: number };

  const [pendingSaves, setPendingSaves] = useState<PendingSave[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Persist a single save action; returns true on success. */
  const executeSave = useCallback(async (save: PendingSave): Promise<boolean> => {
    try {
      if (save.type === "upsert") {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: save.courseId, status: save.status, semester: save.semester }),
        });
        return res.ok;
      } else {
        const res = await fetch(`/api/progress?courseId=${save.courseId}`, { method: "DELETE" });
        return res.ok;
      }
    } catch {
      return false;
    }
  }, []);

  /** Flush all pending saves. */
  const flushPendingSaves = useCallback(async () => {
    setPendingSaves((prev) => {
      if (prev.length === 0) return prev;
      setSaveStatus("saving");
      // Deduplicate: keep last save per courseId
      const byId = new Map<number, PendingSave>();
      for (const s of prev) byId.set(s.courseId, s);
      const deduped = Array.from(byId.values());

      (async () => {
        const failed: PendingSave[] = [];
        for (const save of deduped) {
          const ok = await executeSave(save);
          if (!ok) failed.push(save);
        }
        if (failed.length > 0) {
          setPendingSaves((p) => [...p, ...failed]);
          setSaveStatus("error");
        } else {
          setSaveStatus("saved");
        }
      })();
      return []; // optimistically clear
    });
  }, [executeSave]);

  /** Queue a save and auto-flush after a short debounce. */
  const queueSave = useCallback((save: PendingSave) => {
    setPendingSaves((prev) => [...prev, save]);
    setSaveStatus("saving");
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => flushPendingSaves(), 800);
  }, [flushPendingSaves]);

  // Retry failed saves periodically
  useEffect(() => {
    if (saveStatus !== "error") return;
    const id = setTimeout(() => flushPendingSaves(), 5000);
    return () => clearTimeout(id);
  }, [saveStatus, flushPendingSaves]);

  const semesters = useMemo(
    () => generateSemesters(startSemester, endSemester),
    [startSemester, endSemester],
  );

  // Merge server courses with locally-added (avoid duplicates), exclude removed
  const allCourses = useMemo(() => {
    const ids = new Set(courses.map((c) => c.id));
    return [...courses, ...locallyAdded.filter((c) => !ids.has(c.id))].filter(
      (c) => !removedIds.has(c.id)
    );
  }, [courses, locallyAdded, removedIds]);

  // Map: courseId → assigned semester (all statuses — allows moving any course)
  const [assignments, setAssignments] = useState<Map<number, string>>(() => {
    const map = new Map<number, string>();
    for (const c of courses) {
      if (c.semester) {
        map.set(c.id, c.semester);
      }
    }
    return map;
  });

  const existingIds = useMemo(() => new Set(allCourses.map((c) => c.id)), [allCourses]);

  // Reactive planned stats (credits only) — only courses placed in a semester
  const plannedStats = useMemo(() => {
    const placed = allCourses.filter((c) => c.status === "planned" && assignments.has(c.id));
    const credits = placed.reduce((s, c) => s + c.credits, 0);
    return { credits };
  }, [allCourses, assignments]);

  // Set of course CODES that are placed in a semester (for degree requirement projection)
  const placedCodes = useMemo(
    () => new Set(
      allCourses
        .filter((c) => c.status === "planned" && assignments.has(c.id))
        .map((c) => c.code)
    ),
    [allCourses, assignments]
  );

  const projectedHubCapacities = useMemo(() => {
    const placedPlanned = allCourses.filter((c) => c.status === "planned" && assignments.has(c.id));
    return progress.hubCapacities.map((cap) => {
      const areas = cap.areas.map((area) => {
        const plannedContributing = placedPlanned
          .filter((c) => c.hubAreas.some((ha) => ha.code === area.code))
          .map((c) => ({
            code: c.code,
            title: c.title,
            semester: assignments.get(c.id) ?? "",
            grade: "",
            isPlanned: true as const,
          }));
        const allContributing = [...area.contributingCourses, ...plannedContributing];
        const unitsFulfilled = Math.min(allContributing.length, area.unitsRequired);
        return { ...area, contributingCourses: allContributing, unitsFulfilled };
      });
      return { ...cap, areas, unitsFulfilled: areas.reduce((s, a) => s + a.unitsFulfilled, 0) };
    });
  }, [progress.hubCapacities, allCourses, assignments]);

  const projectedHubFulfilled = projectedHubCapacities.reduce((s, c) => s + c.unitsFulfilled, 0);

  const doubleCountedSet = useMemo(
    () => new Set(progress.doubleCountedCodes),
    [progress.doubleCountedCodes],
  );

  // Map<semester, conflict messages[]>
  const scheduleConflicts = useMemo(() => {
    const result = new Map<string, string[]>();

    for (const semester of semesters) {
      const term = semester.split(" ")[0];

      const coursesHere = allCourses.filter((c) => {
        if (c.status === "planned") return assignments.get(c.id) === semester;
        // completed/in-progress: check assignments first (moved courses), fall back to original
        return assignments.has(c.id) ? assignments.get(c.id) === semester : c.semester === semester;
      });
      if (coursesHere.length < 2) continue;

      // Deduplicated timeslots per course for this term
      const withSlots = coursesHere
        .map((c) => ({ code: c.code, slots: c.sections.filter((s) => s.term === term) }))
        .filter((c) => c.slots.length > 0);

      if (withSlots.length < 2) continue;

      // Cartesian product — cap at 8000 combos to stay snappy
      const combos = cartesian(withSlots.map((c) => c.slots)).slice(0, 8000);
      const hasValidCombo = combos.some((combo) => {
        for (let i = 0; i < combo.length; i++) {
          for (let j = i + 1; j < combo.length; j++) {
            if (slotsOverlap(combo[i], combo[j])) return false;
          }
        }
        return true;
      });

      if (hasValidCombo) continue;

      // Build explanation — find pairs that always conflict
      const messages: string[] = [];
      for (let i = 0; i < withSlots.length; i++) {
        for (let j = i + 1; j < withSlots.length; j++) {
          const a = withSlots[i];
          const b = withSlots[j];
          const pairAlwaysConflicts = a.slots.every((sa) =>
            b.slots.every((sb) => slotsOverlap(sa, sb))
          );
          if (pairAlwaysConflicts) {
            const slot = a.slots[0];
            const days = slot.days.replace(/,/g, "/");
            const time = `${slot.startTime}–${slot.endTime}`;
            messages.push(
              `${a.code.replace(SHORT_SCHOOL, "")} & ${b.code.replace(SHORT_SCHOOL, "")} — ${days} ${time}`
            );
          }
        }
      }
      if (messages.length === 0) {
        // Multi-way deadlock with no always-conflicting pair
        const names = withSlots.map((c) => c.code.replace(SHORT_SCHOOL, "")).join(", ");
        messages.push(`no schedule combination works for ${names}`);
      }

      result.set(semester, messages);
    }

    return result;
  }, [allCourses, assignments, semesters]);

  // Pool: courses without an assigned semester (planned, or completed/in-progress with no semester)
  const pool = useMemo(
    () => allCourses.filter((c) => {
      if (c.status === "planned") return !assignments.has(c.id);
      // Completed/in-progress with no semester — they need to be placed somewhere
      if (c.status === "completed" || c.status === "in-progress") {
        return !assignments.has(c.id) && !c.semester;
      }
      return false;
    }),
    [allCourses, assignments]
  );

  // Courses that should not be taken in the same semester (heavy workload pairing)
  const AVOID_PAIRING: [string, string][] = [
    ["CAS CS 320", "CAS CS 330"],
  ];

  // Mutually exclusive courses — can only take one, not both
  const MUTUALLY_EXCLUSIVE: [string, string][] = [
    ["CAS CS 541", "CAS CS 542"],
  ];

  // Courses that may be restricted to graduate students or hard to enroll in as undergrad
  const GRAD_RESTRICTED = new Set([
    "CAS CS 505",
    "CAS CS 585",
  ]);

  function getViolations(course: PlannerCourse, targetSemester: string): string[] {
    const targetOrd = semesterOrder(targetSemester);
    const targetTerm = targetSemester.split(" ")[0]; // "Fall", "Spring", "Summer"
    const violations: string[] = [];

    // ── Graduate restriction warning ──────────────────────────────────────
    if (GRAD_RESTRICTED.has(course.code)) {
      violations.push("may be restricted to grad students / hard to enroll");
    }

    // ── Heavy pairing warning ─────────────────────────────────────────────
    for (const [a, b] of AVOID_PAIRING) {
      const other = course.code === a ? b : course.code === b ? a : null;
      if (!other) continue;
      const otherCourse = allCourses.find((c) => c.code === other);
      if (!otherCourse) continue;
      const otherSem = assignments.get(otherCourse.id) ?? otherCourse.semester;
      if (otherSem === targetSemester) {
        const shortOther = other.replace(/^(?:CAS|ENG|QST|COM|SAR|SHA|SPH|SSW|STH|MET|CFA|CGS|WED|LAW|GRS|CDS)\s+/, "");
        violations.push(`heavy pairing with ${shortOther} — consider splitting`);
      }
    }

    // ── Mutual exclusivity warning ────────────────────────────────────────
    for (const [a, b] of MUTUALLY_EXCLUSIVE) {
      const other = course.code === a ? b : course.code === b ? a : null;
      if (!other) continue;
      const otherCourse = allCourses.find((c) => c.code === other);
      if (!otherCourse) continue;
      // Warn if the other course is anywhere in the plan (any status except no semester & not assigned)
      const otherSem = assignments.get(otherCourse.id) ?? otherCourse.semester;
      const otherStatus = otherCourse.status;
      if (otherSem || otherStatus === "planned" || otherStatus === "completed" || otherStatus === "in_progress") {
        const shortOther = other.replace(/^(?:CAS|ENG|QST|COM|SAR|SHA|SPH|SSW|STH|MET|CFA|CGS|WED|LAW|GRS|CDS)\s+/, "");
        violations.push(`cannot take both this and ${shortOther}`);
      }
    }

    // ── Term availability warning ─────────────────────────────────────────
    // Only warn when there IS schedule data AND the target term is absent
    if (course.offeredTerms.length > 0 && !course.offeredTerms.includes(targetTerm)) {
      const terms = course.offeredTerms.join("/");
      violations.push(`usually only offered in ${terms}`);
    }

    // ── Per-course schedule conflict check ────────────────────────────────
    // Check if this course has at least one section that fits with other
    // courses already placed in the same semester.
    const mySections = course.sections.filter((s) => s.term === targetTerm);
    if (mySections.length > 0) {
      // Other courses in this semester that have section data
      const others = allCourses.filter((c) => {
        if (c.id === course.id) return false;
        const sem = c.status === "planned" ? assignments.get(c.id) : c.semester;
        return sem === targetSemester;
      });

      const othersWithSlots = others
        .map((c) => ({
          code: c.code,
          slots: c.sections.filter((s) => s.term === targetTerm),
        }))
        .filter((c) => c.slots.length > 0);

      if (othersWithSlots.length > 0) {
        // For each of my sections, check if there's a valid combo with all others
        const hasViableSection = mySections.some((mySlot) => {
          // This section must not conflict with at least one section of each other course
          return othersWithSlots.every((other) =>
            other.slots.some((otherSlot) => !slotsOverlap(mySlot, otherSlot))
          );
        });

        if (!hasViableSection) {
          // Find which courses conflict
          const conflicting = othersWithSlots
            .filter((other) =>
              mySections.every((mySlot) =>
                other.slots.every((otherSlot) => slotsOverlap(mySlot, otherSlot))
              )
            )
            .map((c) => c.code.replace(SHORT_SCHOOL, ""));

          if (conflicting.length > 0) {
            violations.push(`all sections conflict with ${conflicting.join(", ")}`);
          } else {
            violations.push("no section fits with current schedule");
          }
        }
      }
    }

    // ── Prerequisite checks (respect AND / OR groups) ─────────────────────
    // Group prereqs by groupId
    const byGroup = new Map<number, typeof course.prereqs>();
    for (const p of course.prereqs) {
      const g = byGroup.get(p.groupId) ?? [];
      g.push(p);
      byGroup.set(p.groupId, g);
    }

    for (const [, members] of byGroup) {
      const groupType = members[0].groupType; // "AND" or "OR"

      // Helper: is a single prereq satisfied (completed or placed before target)?
      function isSatisfied(prereqCode: string): boolean {
        const pc = allCourses.find((c) => c.code === prereqCode);
        if (!pc) return true; // not tracked → assume satisfied (not in our plan)
        if (pc.status === "completed") return true;
        const sem = assignments.get(pc.id) ?? pc.semester;
        return !!sem && semesterOrder(sem) < targetOrd;
      }

      if (groupType === "OR") {
        // OR group: at least one member must be satisfied
        const anySatisfied = members.some((p) => isSatisfied(p.code));
        if (!anySatisfied) {
          const codes = members.map((p) => p.code.replace(/^(?:CAS|ENG|QST|COM|SAR|SHA|SPH|SSW|STH|MET|CFA|CGS|WED|LAW|GRS|CDS)\s+/, ""));
          violations.push(`need one of: ${codes.join(", ")}`);
        }
      } else {
        // AND group: every member must be satisfied
        for (const p of members) {
          if (!isSatisfied(p.code)) {
            const pc = allCourses.find((c) => c.code === p.code);
            const shortCode = p.code.replace(/^(?:CAS|ENG|QST|COM|SAR|SHA|SPH|SSW|STH|MET|CFA|CGS|WED|LAW|GRS|CDS)\s+/, "");
            if (!pc || (!assignments.get(pc.id) && !pc.semester)) {
              violations.push(`${shortCode} not planned`);
            } else {
              violations.push(`${shortCode} must come first`);
            }
          }
        }
      }
    }

    return violations;
  }

  function savePlan(courseId: number, semester: string) {
    const course = allCourses.find((c) => c.id === courseId);
    const status = course?.status || "planned";
    setAssignments((prev) => new Map(prev).set(courseId, semester));
    queueSave({ type: "upsert", courseId, status, semester });
  }

  function removePlan(courseId: number) {
    const course = allCourses.find((c) => c.id === courseId);
    // Only planned courses go back to unplanned pool; completed/in-progress
    // keep their original semester
    if (course && course.status !== "planned" && course.status) {
      // Reset to original semester
      const origSemester = course.semester ?? "";
      setAssignments((prev) => {
        const next = new Map(prev);
        if (origSemester) {
          next.set(courseId, origSemester);
        } else {
          next.delete(courseId);
        }
        return next;
      });
      if (origSemester) {
        queueSave({ type: "upsert", courseId, status: course.status, semester: origSemester });
      }
      return;
    }
    setAssignments((prev) => {
      const next = new Map(prev);
      next.delete(courseId);
      return next;
    });
    queueSave({ type: "upsert", courseId, status: "planned", semester: "" });
  }

  function removeFromPlanner(courseId: number) {
    setAssignments((prev) => {
      const next = new Map(prev);
      next.delete(courseId);
      return next;
    });
    setRemovedIds((prev) => new Set(prev).add(courseId));
    setLocallyAdded((prev) => prev.filter((c) => c.id !== courseId));
    queueSave({ type: "delete", courseId });
  }

  function handleDrop(semester: string) {
    if (draggedCourse) {
      savePlan(draggedCourse.id, semester);
      setDraggedCourse(null);
    }
  }

  function handleAddFromSearch(course: PlannerCourse) {
    setLocallyAdded((prev) => {
      if (prev.some((c) => c.id === course.id)) return prev;
      return [...prev, course];
    });
    queueSave({ type: "upsert", courseId: course.id, status: "planned", semester: "" });
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const { exportPlannerPdf } = await import("@/lib/plannerPdf");
      await exportPlannerPdf(
        allCourses,
        assignments,
        semesters,
        {
          totalCreditsEarned: progress.totalCreditsEarned,
          totalCreditsInProgress: progress.totalCreditsInProgress,
          totalCreditsRequired: progress.totalCreditsRequired,
          gpa: progress.gpa,
          hubCapacities: projectedHubCapacities.map((cap) => ({
            capacity: cap.capacity,
            unitsFulfilled: cap.unitsFulfilled,
            unitsRequired: cap.unitsRequired,
            areas: cap.areas.map((a) => ({
              code: a.code,
              name: a.name,
              unitsFulfilled: a.unitsFulfilled,
              unitsRequired: a.unitsRequired,
            })),
          })),
          programs: progress.programs.map((p) => ({
            name: p.name,
            isActive: p.isActive,
            totalCompleted: p.totalCompleted,
            totalRequired: p.totalRequired,
            schoolRequirements: p.schoolRequirements.map((r) => ({
              name: r.name,
              satisfied: r.satisfied,
              inProgress: r.inProgress,
              current: r.current,
              target: r.target,
            })),
          })),
        },
        plannedStats.credits
      );
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importInputRef.current) importInputRef.current.value = "";

    if (!window.confirm(
      `Import planner from "${file.name}"?\n\nThis will overwrite your current planner data.`
    )) return;

    setImportStatus({ type: "loading" });
    try {
      const { importPlannerPdf } = await import("@/lib/plannerPdf");
      const data = await importPlannerPdf(file);

      const res = await fetch("/api/planner/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses: data.courses }),
      });

      if (!res.ok) throw new Error("Server import failed");
      const result = await res.json() as { imported: number; skipped: number };

      setImportStatus({
        type: "success",
        msg: `Imported ${result.imported} courses${result.skipped > 0 ? ` (${result.skipped} not found)` : ""}. Reloading…`,
      });
      setTimeout(() => window.location.reload(), 1800);
    } catch (err) {
      setImportStatus({
        type: "error",
        msg: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Collapsible progress panel */}
      <div data-tour="planner-summary" className="bg-card border border-card-border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowPanel((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          <span>Progress Overview</span>
          <div className="flex items-center gap-3 text-xs font-normal text-muted">
            <span>{progress.totalCreditsEarned + progress.totalCreditsInProgress + plannedStats.credits}/{progress.totalCreditsRequired} credits</span>
            <span>{projectedHubFulfilled}/{progress.hubUnitsTotal} hub units</span>
            <span>GPA {progress.gpa.toFixed(2)}</span>
            <span>{showPanel ? "▲" : "▼"}</span>
          </div>
        </button>
        {showPanel && (
          <div className="px-5 pb-5 border-t border-card-border">
            <ProgressPanel
              progress={progress}
              plannedCredits={plannedStats.credits}
              projectedHubCapacities={projectedHubCapacities}
              projectedHubFulfilled={projectedHubFulfilled}
              placedCodes={placedCodes}
            />
          </div>
        )}
      </div>

      {/* Semester range selector + export/import */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="font-medium">Show semesters from</span>
          <SemesterPicker value={startSemester} onChange={setStartSemester} />
          <span className="font-medium">to</span>
          <SemesterPicker value={endSemester} onChange={setEndSemester} />
        </div>

        <div className="flex items-center gap-2 text-xs">
          {/* Save status indicator */}
          <span className={`flex items-center gap-1 text-xs ${
            saveStatus === "saved" ? "text-success" :
            saveStatus === "saving" ? "text-muted" :
            "text-accent"
          }`}>
            {saveStatus === "saved" && <span title="All changes saved">&#10003; Saved</span>}
            {saveStatus === "saving" && <span>Saving…</span>}
            {saveStatus === "error" && <span title="Some changes failed to save — click Save Progress to retry">&#9888; Unsaved changes</span>}
          </span>

          <button
            onClick={() => flushPendingSaves()}
            disabled={saveStatus === "saving"}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1 font-medium ${
              saveStatus === "error"
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-success/90 text-white hover:bg-success"
            } disabled:opacity-50`}
          >
            {saveStatus === "saving" ? "Saving…" : "Save Progress"}
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-3 py-1.5 bg-info text-white rounded-md hover:bg-info/90 disabled:opacity-50 flex items-center gap-1 font-medium"
          >
            {isExporting ? "Generating…" : "↓ Export PDF"}
          </button>

          <label className="px-3 py-1.5 bg-card border border-card-border rounded-md hover:bg-gray-50 cursor-pointer flex items-center gap-1 font-medium text-secondary">
            ↑ Import PDF
            <input
              ref={importInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleImportFile}
            />
          </label>

          {importStatus.type !== "idle" && (
            <span
              className={`max-w-xs truncate ${
                importStatus.type === "error"   ? "text-accent" :
                importStatus.type === "success" ? "text-success" :
                "text-muted"
              }`}
            >
              {importStatus.type === "loading" ? "Importing…" : importStatus.msg}
            </span>
          )}
        </div>
      </div>

      {/* Planner grid */}
      <div className="flex gap-4">
        {/* Unplanned pool — fixed sidebar, does not scroll with semesters */}
        <div className="w-56 shrink-0 flex flex-col gap-2">
          <div>
            <h3 className="text-sm font-semibold text-muted">
              Unplanned
              <span className="ml-1 font-normal text-xs">({pool.length})</span>
            </h3>
            <p className="text-[10px] text-muted mt-0.5">
              Drag to a semester or click × to remove
            </p>
          </div>

          {/* Search to add courses */}
          <AddCoursePanel onAdd={handleAddFromSearch} existingIds={existingIds} />

          {/* Pool items */}
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-0.5">
            {pool.map((c) => {
              const isCompleted = c.status === "completed";
              const isInProgress = c.status === "in-progress";
              const isFixed = isCompleted || isInProgress;
              return (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDraggedCourse(c)}
                  className={`border rounded p-2 text-xs cursor-grab active:cursor-grabbing hover:border-accent/30 relative group ${
                    isCompleted
                      ? "bg-success-light border-success/20"
                      : isInProgress
                      ? "bg-warning-light border-warning/20"
                      : "bg-card border-card-border"
                  }`}
                >
                  {!isFixed && (
                    <button
                      onClick={() => removeFromPlanner(c.id)}
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-200 text-muted text-[10px] items-center justify-center hidden group-hover:flex hover:bg-accent hover:text-white"
                    >
                      ×
                    </button>
                  )}
                  <span className="font-semibold">{c.code}</span>
                  <p className="text-muted truncate pr-4">{c.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {isFixed ? (
                      <span className={`text-[9px] font-medium ${
                        isCompleted ? "text-success" : "text-warning"
                      }`}>
                        {isCompleted ? `✓ Done${c.grade ? ` (${c.grade})` : ""}` : "In Progress"} — drag to a semester
                      </span>
                    ) : (
                      <span className="text-muted">{c.credits}cr</span>
                    )}
                    {c.hubAreas.map((ha) => (
                      <span key={ha.code} className="text-[9px] bg-info-light text-info px-1 py-0.5 rounded">
                        {ha.code}
                      </span>
                    ))}
                    {doubleCountedSet.has(c.code) && (
                      <span className="text-[9px] bg-warning-light text-warning px-1 py-0.5 rounded font-medium">
                        2× pgm
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {pool.length === 0 && (
              <p className="text-xs text-muted">
                No unplanned courses. Search above to add some.
              </p>
            )}
          </div>
        </div>

        {/* Scrollable semester columns */}
        <div data-tour="planner-columns" className="flex gap-4 overflow-x-auto pb-4 flex-1">

        {/* Semester columns */}
        {semesters.map((semester) => {
          const isSummer = semester.startsWith("Summer");

          // Planned courses assigned to this semester
          const plannedHere = allCourses.filter(
            (c) => c.status === "planned" && assignments.get(c.id) === semester
          );

          // Completed / in-progress courses — check assignments first (for moved courses), fall back to original semester
          const fixedHere = allCourses.filter(
            (c) =>
              (c.status === "completed" || c.status === "in-progress") &&
              (assignments.has(c.id) ? assignments.get(c.id) === semester : c.semester === semester)
          );

          const allHere = [...fixedHere, ...plannedHere];
          const totalCredits = allHere.reduce((s, c) => s + c.credits, 0);
          const hubCodes = new Set(allHere.flatMap((c) => c.hubAreas.map((ha) => ha.code)));

          return (
            <div
              key={semester}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(semester)}
              className={`w-44 shrink-0 rounded-lg p-2 min-h-[200px] border-2 border-dashed border-transparent hover:border-accent/20 transition-colors ${
                isSummer ? "bg-amber-50/60" : "bg-gray-50"
              }`}
            >
              {/* Semester header */}
              <div className="flex items-center justify-between mb-1">
                <h3 className={`text-xs font-semibold ${isSummer ? "text-amber-700" : ""}`}>
                  {isSummer ? "☀ " : ""}{semester}
                </h3>
                <div className="flex items-center gap-1">
                  {totalCredits > 0 && (
                    <span className={`text-[10px] font-medium ${
                      totalCredits > 20
                        ? "text-danger"
                        : totalCredits >= 18
                        ? "text-warning"
                        : "text-muted"
                    }`}>
                      {totalCredits} cr{totalCredits > 20 ? " ⚠ needs approval" : totalCredits >= 18 ? " ⚠ over standard" : ""}
                    </span>
                  )}
                </div>
              </div>

              {hubCodes.size > 0 && (
                <div className="flex flex-wrap gap-0.5 mb-1.5">
                  {[...hubCodes].map((code) => (
                    <span key={code} className="text-[9px] bg-info-light text-info px-1 py-0.5 rounded">
                      {code}
                    </span>
                  ))}
                </div>
              )}

              {scheduleConflicts.has(semester) && (
                <div className="mb-1.5 px-1.5 py-1 bg-accent/5 border border-accent/25 rounded text-[9px] text-accent leading-tight">
                  <span className="font-semibold">⚠ Schedule conflict</span>
                  {scheduleConflicts.get(semester)!.map((msg, i) => (
                    <p key={i} className="mt-0.5 text-accent/80">{msg}</p>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                {/* Completed/in-progress courses — draggable to rearrange */}
                {fixedHere.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDraggedCourse(c)}
                    className={`border rounded p-2 text-xs cursor-grab active:cursor-grabbing relative group ${
                      c.status === "completed"
                        ? "bg-success-light border-success/20"
                        : "bg-warning-light border-warning/20"
                    }`}
                  >
                    {assignments.has(c.id) && assignments.get(c.id) !== c.semester && (
                      <button
                        onClick={() => removePlan(c.id)}
                        title="Reset to original semester"
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-200 text-muted text-[10px] items-center justify-center hidden group-hover:flex hover:bg-info hover:text-white"
                      >
                        ↩
                      </button>
                    )}
                    <Link href={`/courses/${c.slug}`} className="hover:underline">
                      <span className="font-semibold">{c.code}</span>
                    </Link>
                    <p className="text-muted truncate">{c.title}</p>
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] font-medium ${
                        c.status === "completed" ? "text-success" : "text-warning"
                      }`}>
                        {c.status === "completed" ? `✓ Done${c.grade ? ` (${c.grade})` : ""}` : "In Progress"}
                      </span>
                      {assignments.has(c.id) && assignments.get(c.id) !== c.semester && (
                        <span className="text-[8px] text-info italic">moved</span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Planned courses — draggable */}
                {plannedHere.map((c) => {
                  const violations = getViolations(c, semester);
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDraggedCourse(c)}
                      className={`bg-card border rounded p-2 text-xs cursor-grab active:cursor-grabbing relative group ${
                        violations.length > 0
                          ? "border-accent bg-accent-light"
                          : "border-card-border"
                      }`}
                    >
                      <button
                        onClick={() => removePlan(c.id)}
                        title="Move back to unplanned pool"
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-200 text-muted text-[10px] items-center justify-center hidden group-hover:flex hover:bg-info hover:text-white"
                      >
                        ↩
                      </button>
                      <button
                        onClick={() => removeFromPlanner(c.id)}
                        title="Remove from planner"
                        className="absolute top-1 right-6 w-4 h-4 rounded-full bg-gray-200 text-muted text-[10px] items-center justify-center hidden group-hover:flex hover:bg-accent hover:text-white"
                      >
                        ×
                      </button>
                      <span className="font-semibold">{c.code}</span>
                      <p className="text-muted truncate pr-10">{c.title}</p>
                      {(c.hubAreas.length > 0 || doubleCountedSet.has(c.code)) && (
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {c.hubAreas.map((ha) => (
                            <span key={ha.code} className="text-[9px] bg-info-light text-info px-1 py-0.5 rounded">
                              {ha.code}
                            </span>
                          ))}
                          {doubleCountedSet.has(c.code) && (
                            <span className="text-[9px] bg-warning-light text-warning px-1 py-0.5 rounded font-medium">
                              2× pgm
                            </span>
                          )}
                        </div>
                      )}
                      {violations.length > 0 && violations.map((v, i) => {
                        const isSoft = v.startsWith("usually") || v.startsWith("may be restricted") || v.startsWith("heavy pairing");
                        return isSoft ? (
                          <p key={i} className="text-[8px] text-warning/60 italic mt-0.5 leading-tight">
                            {v}
                          </p>
                        ) : (
                          <p key={i} className="text-[10px] text-accent font-medium mt-0.5">
                            ⚠ {v}
                          </p>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {allHere.length === 0 && (
                <p className="text-[10px] text-muted text-center mt-8">Drop courses here</p>
              )}
            </div>
          );
        })}

        </div>{/* end scrollable semester columns */}
      </div>
    </div>
  );
}
