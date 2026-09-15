"use client";

import { useState, useMemo } from "react";
import { GRADE_POINTS } from "@/lib/constants";

const GRADE_OPTIONS = [
  "A", "A-",
  "B+", "B", "B-",
  "C+", "C", "C-",
  "D+", "D", "D-",
  "F",
  "P", // Pass — does not affect GPA
];

interface Course {
  courseId: number;
  code: string;
  title: string;
  credits: number;
  semester: string;
  grade: string;
}

function semesterSortKey(sem: string): number {
  if (!sem) return Infinity;
  const [season, yearStr] = sem.split(" ");
  const year = parseInt(yearStr, 10);
  if (Number.isNaN(year)) return Infinity;
  if (season === "Spring") return year * 10 + 1;
  if (season === "Summer") return year * 10 + 6;
  if (season === "Fall") return year * 10 + 8;
  return Infinity;
}

export default function GradeEditor({ courses: initialCourses }: { courses: Course[] }) {
  const [courses, setCourses] = useState(initialCourses);
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Set<number>>(new Set());

  async function updateGrade(courseId: number, grade: string) {
    // Optimistic update
    setCourses((prev) =>
      prev.map((c) => (c.courseId === courseId ? { ...c, grade } : c))
    );
    setSaving((prev) => new Set(prev).add(courseId));
    setErrors((prev) => {
      const next = new Set(prev);
      next.delete(courseId);
      return next;
    });

    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, status: "completed", grade }),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch {
      // Revert to original
      const original = initialCourses.find((c) => c.courseId === courseId)?.grade ?? "";
      setCourses((prev) =>
        prev.map((c) => (c.courseId === courseId ? { ...c, grade: original } : c))
      );
      setErrors((prev) => new Set(prev).add(courseId));
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
    }
  }

  // Cumulative GPA
  const { gpa, gradedCredits } = useMemo(() => {
    let points = 0;
    let credits = 0;
    for (const c of courses) {
      if (c.grade && GRADE_POINTS[c.grade] !== undefined) {
        points += GRADE_POINTS[c.grade] * c.credits;
        credits += c.credits;
      }
    }
    return { gpa: credits > 0 ? points / credits : null, gradedCredits: credits };
  }, [courses]);

  // Group by semester, sorted chronologically
  const grouped = useMemo(() => {
    const map = new Map<string, Course[]>();
    for (const c of courses) {
      const key = c.semester || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()].sort(
      (a, b) => semesterSortKey(a[0]) - semesterSortKey(b[0])
    );
  }, [courses]);

  const ungradedCount = courses.filter((c) => !c.grade).length;

  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted">
        No completed courses yet. Mark courses as completed on their detail pages to track grades here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="bg-card border border-card-border rounded-lg p-5 flex flex-wrap items-center gap-6">
        <div className="text-center min-w-[4rem]">
          <p className="text-3xl font-bold text-accent">
            {gpa !== null ? gpa.toFixed(2) : "—"}
          </p>
          <p className="text-xs text-muted mt-0.5">Cumulative GPA</p>
        </div>
        <div className="h-10 w-px bg-card-border" />
        <div className="text-center">
          <p className="text-xl font-semibold">{gradedCredits}</p>
          <p className="text-xs text-muted mt-0.5">Graded credits</p>
        </div>
        <div className="h-10 w-px bg-card-border" />
        <div className="text-center">
          <p className="text-xl font-semibold">{courses.length}</p>
          <p className="text-xs text-muted mt-0.5">Completed courses</p>
        </div>
        {ungradedCount > 0 && (
          <>
            <div className="h-10 w-px bg-card-border" />
            <p className="text-sm text-warning font-medium">
              {ungradedCount} course{ungradedCount !== 1 ? "s" : ""} missing a grade
            </p>
          </>
        )}
      </div>

      {/* Semester sections */}
      {grouped.map(([semester, semCourses]) => {
        let semPoints = 0;
        let semCredits = 0;
        for (const c of semCourses) {
          if (c.grade && GRADE_POINTS[c.grade] !== undefined) {
            semPoints += GRADE_POINTS[c.grade] * c.credits;
            semCredits += c.credits;
          }
        }
        const semGpa = semCredits > 0 ? (semPoints / semCredits).toFixed(2) : null;
        const semTotalCredits = semCourses.reduce((s, c) => s + c.credits, 0);

        return (
          <div
            key={semester || "__none__"}
            className="bg-card border border-card-border rounded-lg overflow-hidden"
          >
            {/* Semester header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-card-border bg-gray-50 dark:bg-gray-800/30">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-sm">
                  {semester || "No semester set"}
                </h2>
                <span className="text-xs text-muted">
                  {semCourses.length} course{semCourses.length !== 1 ? "s" : ""} · {semTotalCredits} cr
                </span>
              </div>
              {semGpa && (
                <span className="text-xs text-muted">
                  Semester GPA:{" "}
                  <span className="font-semibold text-foreground">{semGpa}</span>
                </span>
              )}
            </div>

            {/* Course table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted w-32">
                    Course
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted">
                    Title
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-muted w-12">
                    Cr
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted w-36">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody>
                {semCourses.map((c, i) => (
                  <tr
                    key={c.courseId}
                    className={
                      i < semCourses.length - 1
                        ? "border-b border-card-border"
                        : ""
                    }
                  >
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-muted">
                      {c.code}
                    </td>
                    <td className="px-4 py-2.5">{c.title}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-muted">
                      {c.credits}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <select
                          value={c.grade}
                          onChange={(e) => updateGrade(c.courseId, e.target.value)}
                          disabled={saving.has(c.courseId)}
                          className={`px-2 py-1 text-xs border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 ${
                            errors.has(c.courseId)
                              ? "border-red-400"
                              : "border-card-border"
                          } ${!c.grade ? "text-muted" : "font-semibold"}`}
                        >
                          <option value="">— not set —</option>
                          {GRADE_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                        {saving.has(c.courseId) && (
                          <span className="text-xs text-muted">saving…</span>
                        )}
                        {errors.has(c.courseId) && (
                          <span className="text-xs text-red-500">failed</span>
                        )}
                        {c.grade && GRADE_POINTS[c.grade] !== undefined && (
                          <span className="text-xs text-muted tabular-nums">
                            {GRADE_POINTS[c.grade].toFixed(1)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
