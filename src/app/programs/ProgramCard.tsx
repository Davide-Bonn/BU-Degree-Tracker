"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface GroupCourse {
  code: string;
  title: string | null;
  isRequired: boolean;
  status: string | null;
  grade: string | null;
  semester: string | null;
  slug: string | null;
}

interface Group {
  groupName: string;
  description: string;
  minCourses: number;
  completedCount: number;
  inProgressCount: number;
  courses: GroupCourse[];
}

interface Program {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string;
  isActive: boolean;
  totalRequired: number;
  totalCompleted: number;
  groups: Group[];
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  major: { label: "Major", color: "bg-accent text-white" },
  minor: { label: "Minor", color: "bg-info text-white" },
  "joint-major": { label: "Joint Major", color: "bg-success text-white" },
};

function CourseRow({ course }: { course: GroupCourse }) {
  const statusBg: Record<string, string> = {
    completed: "bg-success-light border-success/20",
    "in-progress": "bg-warning-light border-warning/20",
    planned: "bg-info-light border-info/20",
  };
  const iconBg: Record<string, string> = {
    completed: "bg-success text-white",
    "in-progress": "bg-warning text-white",
    planned: "bg-info text-white",
  };
  const style = course.status
    ? statusBg[course.status] || "bg-gray-50 border-gray-200"
    : "bg-gray-50 border-gray-200";
  const icon = course.status
    ? iconBg[course.status] || "bg-gray-200 text-muted"
    : "bg-gray-200 text-muted";

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm ${style}`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${icon}`}
        >
          {course.status === "completed" ? (
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={3}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          ) : course.status === "in-progress" ? (
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="9" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 7v5l2.5 2.5"
              />
            </svg>
          ) : course.status === "planned" ? (
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path strokeLinecap="round" d="M3 9h18M8 2v4M16 2v4" />
            </svg>
          ) : (
            <span className="text-[10px]">–</span>
          )}
        </div>
        <div className="min-w-0">
          {course.slug ? (
            <Link
              href={`/courses/${course.slug}`}
              className="font-medium hover:underline"
            >
              {course.code}
            </Link>
          ) : (
            <span className="font-medium">{course.code}</span>
          )}
          {course.title && (
            <span className="text-muted ml-1.5 text-xs">{course.title}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {course.isRequired && (
          <span className="text-[10px] bg-accent-light text-accent px-1.5 py-0.5 rounded">
            Required
          </span>
        )}
        {course.grade && (
          <span className="text-xs font-semibold bg-white/70 px-1.5 py-0.5 rounded">
            {course.grade}
          </span>
        )}
        {course.semester && !course.grade && (
          <span className="text-xs text-muted">{course.semester}</span>
        )}
      </div>
    </div>
  );
}

export default function ProgramCard({ program }: { program: Program }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(program.isActive);
  const [toggling, setToggling] = useState(false);

  const { label, color } =
    TYPE_LABELS[program.type] ?? { label: program.type, color: "bg-gray-400 text-white" };
  const pct =
    program.totalRequired > 0
      ? Math.min((program.totalCompleted / program.totalRequired) * 100, 100)
      : 0;
  const remaining = program.totalRequired - program.totalCompleted;

  const alreadyDone = program.groups.reduce(
    (sum, g) => sum + Math.min(g.completedCount, g.minCourses),
    0
  );
  const inProgress = program.groups.reduce((sum, g) => sum + g.inProgressCount, 0);

  async function handleToggleActive() {
    if (toggling) return;
    setToggling(true);
    const newActive = !isActive;
    setIsActive(newActive);
    await fetch("/api/programs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: program.id, isActive: newActive }),
    });
    router.refresh();
    setToggling(false);
  }

  return (
    <div
      className={`bg-card border rounded-xl overflow-hidden transition-shadow ${
        isActive ? "border-accent/40 shadow-sm" : "border-card-border"
      }`}
    >
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}
              >
                {label}
              </span>
              {isActive && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent-light text-accent">
                  Tracking
                </span>
              )}
            </div>
            <h3 className="font-semibold text-base">{program.name}</h3>
            <p className="text-xs text-muted mt-0.5">{program.description}</p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Summary numbers */}
            <div className="text-right">
              <p className="text-2xl font-bold text-accent leading-none">{alreadyDone}</p>
              <p className="text-xs text-muted">of {program.totalRequired} done</p>
              {inProgress > 0 && (
                <p className="text-xs text-warning">{inProgress} in progress</p>
              )}
            </div>

            {/* Toggle tracking button */}
            <button
              onClick={handleToggleActive}
              disabled={toggling}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                isActive
                  ? "bg-accent text-white border-accent hover:bg-accent/80"
                  : "bg-white text-muted border-card-border hover:border-accent hover:text-accent"
              }`}
            >
              {toggling ? "…" : isActive ? "Stop Tracking" : "Track This"}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
          <div
            className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-success" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Status line */}
        <div className="flex items-center justify-between text-xs">
          <span className={remaining <= 0 ? "text-success font-medium" : "text-muted"}>
            {remaining <= 0
              ? "All requirements met!"
              : `${remaining} more course${remaining !== 1 ? "s" : ""} needed`}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-info hover:underline"
          >
            {expanded ? "Hide details ▲" : "Show details ▼"}
          </button>
        </div>
      </div>

      {/* Expandable requirements */}
      {expanded && (
        <div className="border-t border-card-border">
          {/* Group tabs */}
          <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
            <button
              onClick={() => setActiveGroup(null)}
              className={`text-xs px-3 py-1.5 rounded-full shrink-0 transition-colors ${
                activeGroup === null
                  ? "bg-accent text-white"
                  : "bg-gray-100 text-muted hover:bg-gray-200"
              }`}
            >
              All groups
            </button>
            {program.groups.map((g) => {
              const done = g.completedCount >= g.minCourses;
              return (
                <button
                  key={g.groupName}
                  onClick={() =>
                    setActiveGroup(activeGroup === g.groupName ? null : g.groupName)
                  }
                  className={`text-xs px-3 py-1.5 rounded-full shrink-0 transition-colors flex items-center gap-1.5 ${
                    activeGroup === g.groupName
                      ? "bg-accent text-white"
                      : done
                      ? "bg-success-light text-success hover:bg-success/20"
                      : "bg-gray-100 text-muted hover:bg-gray-200"
                  }`}
                >
                  {done && (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  )}
                  {g.groupName}
                  <span className="opacity-70">
                    {g.completedCount}/{g.minCourses}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Groups content */}
          <div className="p-4 space-y-5">
            {program.groups
              .filter((g) => activeGroup === null || g.groupName === activeGroup)
              .map((group) => {
                const groupDone = group.completedCount >= group.minCourses;
                const stillNeeded = Math.max(0, group.minCourses - group.completedCount - group.inProgressCount);
                return (
                  <div key={group.groupName}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            groupDone
                              ? "bg-success text-white"
                              : "bg-accent-light text-accent"
                          }`}
                        >
                          {group.groupName.length <= 2
                            ? group.groupName
                            : group.groupName[0]}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{group.description}</p>
                          <p className="text-xs text-muted">
                            {groupDone
                              ? `✓ Complete (${group.completedCount}/${group.minCourses})`
                              : stillNeeded > 0
                              ? `${group.completedCount}/${group.minCourses} done — need ${stillNeeded} more`
                              : `${group.completedCount}/${group.minCourses} done (${group.inProgressCount} in progress)`}
                          </p>
                        </div>
                      </div>
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${groupDone ? "bg-success" : "bg-accent"}`}
                          style={{
                            width: `${
                              group.minCourses > 0
                                ? Math.min(
                                    (group.completedCount / group.minCourses) * 100,
                                    100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {group.courses.length > 0 ? (
                      <div className="space-y-1.5 ml-8">
                        {group.courses.map((c) => (
                          <CourseRow key={c.code} course={c} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted ml-8 italic">
                        Any qualifying course in this department/level counts.
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
