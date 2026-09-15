"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const statuses = [
  { value: "completed", label: "Completed", color: "bg-success text-white" },
  { value: "in-progress", label: "In Progress", color: "bg-warning text-white" },
  { value: "planned", label: "Planned", color: "bg-info text-white" },
];

const GRADE_OPTIONS = [
  "A", "A-",
  "B+", "B", "B-",
  "C+", "C", "C-",
  "D+", "D", "D-",
  "F",
  "P", // Pass — does not affect GPA
];

export default function CourseStatusButtons({
  courseId,
  currentStatus,
  currentGrade,
}: {
  courseId: number;
  currentStatus: string | null;
  currentGrade?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [grade, setGradeLocal] = useState(currentGrade || "");

  async function setStatus(status: string) {
    setLoading(true);
    try {
      if (status === currentStatus) {
        await fetch(`/api/progress?courseId=${courseId}`, { method: "DELETE" });
      } else {
        await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, status }),
        });
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function saveGrade(newGrade: string) {
    setLoading(true);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, status: "completed", grade: newGrade }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            disabled={loading}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              currentStatus === s.value
                ? s.color
                : "bg-gray-100 text-muted hover:bg-gray-200"
            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {currentStatus === s.value ? `\u2713 ${s.label}` : s.label}
          </button>
        ))}
      </div>

      {currentStatus === "completed" && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">Grade:</label>
          <select
            value={grade}
            disabled={loading}
            onChange={(e) => {
              setGradeLocal(e.target.value);
              saveGrade(e.target.value);
            }}
            className="px-2 py-1 text-xs border border-card-border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
          >
            <option value="">— not set —</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
