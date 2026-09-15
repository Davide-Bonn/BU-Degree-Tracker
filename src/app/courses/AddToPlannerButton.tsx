"use client";

import { useState } from "react";

export default function AddToPlannerButton({
  courseId,
  initialStatus,
}: {
  courseId: number;
  initialStatus: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  // Don't render for completed or in-progress courses
  if (status === "completed" || status === "in-progress") return null;

  const isPlanned = status === "planned";

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      if (isPlanned) {
        await fetch(`/api/progress?courseId=${courseId}`, { method: "DELETE" });
        setStatus(null);
      } else {
        await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, status: "planned" }),
        });
        setStatus("planned");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`shrink-0 text-xs px-2.5 py-1 rounded-md border transition-colors ${
        isPlanned
          ? "bg-info-light text-info border-info/30 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
          : "bg-white text-muted border-card-border hover:bg-accent hover:text-white hover:border-accent"
      }`}
      title={isPlanned ? "Remove from planner" : "Add to planner"}
    >
      {loading ? "…" : isPlanned ? "✓ In Planner" : "+ Plan"}
    </button>
  );
}
