"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { HubCapacityProgress } from "@/lib/progress";

function CheckIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
function HalfIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l2.5 2.5" />
    </svg>
  );
}

function AddOverrideForm({ hubCode, onAdded }: { hubCode: string; onAdded: () => void }) {
  const [courseName, setCourseName] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!courseName.trim()) return;
    setSaving(true);
    await fetch("/api/hub-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hubCode, courseName, note }),
    });
    setCourseName("");
    setNote("");
    setOpen(false);
    setSaving(false);
    onAdded();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] text-info hover:underline flex items-center gap-1 mt-1"
      >
        <span>+</span> Mark as satisfied with a course not in DB
      </button>
    );
  }

  return (
    <div className="mt-2 p-2.5 bg-white border border-info/30 rounded-lg space-y-2">
      <p className="text-xs font-medium text-muted">Enter the course that satisfied this hub area:</p>
      <input
        type="text"
        placeholder="Course code or name (e.g. CAS HI 251)"
        value={courseName}
        onChange={(e) => setCourseName(e.target.value)}
        className="w-full text-xs px-2 py-1.5 border border-card-border rounded focus:outline-none focus:ring-1 focus:ring-info"
      />
      <input
        type="text"
        placeholder="Optional note (e.g. taken Spring 2024)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full text-xs px-2 py-1.5 border border-card-border rounded focus:outline-none focus:ring-1 focus:ring-info"
      />
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving || !courseName.trim()}
          className="text-xs px-3 py-1 bg-info text-white rounded hover:bg-info/80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs px-3 py-1 bg-gray-100 text-muted rounded hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function HubCapacitySection({
  capacity,
  suggestions,
  hideSatisfied,
  color = "#6b7280",
}: {
  capacity: HubCapacityProgress;
  suggestions: Record<string, { code: string; title: string; slug: string }[]>;
  hideSatisfied: boolean;
  color?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const fullyDone = capacity.unitsFulfilled >= capacity.unitsRequired;
  const [open, setOpen] = useState(!fullyDone);

  const visibleAreas = hideSatisfied
    ? capacity.areas.filter((a) => a.unitsFulfilled < a.unitsRequired)
    : capacity.areas;

  const satisfiedCount = capacity.areas.filter(
    (a) => a.unitsFulfilled >= a.unitsRequired
  ).length;

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function removeOverride(courseName: string, hubCode: string) {
    // Find the override id by fetching all overrides
    const res = await fetch("/api/hub-override");
    const all: { id: string; hubCode: string; courseName: string }[] = await res.json();
    const match = all.find((o) => o.hubCode === hubCode && o.courseName === courseName);
    if (match) {
      await fetch(`/api/hub-override?id=${match.id}`, { method: "DELETE" });
      refresh();
    }
  }

  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
            fullyDone ? "bg-success text-white"
              : capacity.unitsFulfilled > 0 ? "bg-warning text-white"
              : "bg-gray-200 text-muted"
          }`}>
            {fullyDone ? <CheckIcon /> : capacity.unitsFulfilled > 0 ? <HalfIcon /> : <span className="text-[10px]">–</span>}
          </div>
          <span className="font-semibold text-sm" style={{ color: fullyDone ? undefined : color }}>{capacity.capacity}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${fullyDone ? "bg-success" : ""}`}
              style={{
                width: `${capacity.unitsRequired > 0 ? (capacity.unitsFulfilled / capacity.unitsRequired) * 100 : 0}%`,
                backgroundColor: fullyDone ? undefined : color,
              }}
            />
          </div>
          <span className={`text-xs font-semibold w-10 text-right ${fullyDone ? "text-success" : capacity.unitsFulfilled > 0 ? "text-warning" : "text-muted"}`}>
            {capacity.unitsRequired > 0 ? Math.round((capacity.unitsFulfilled / capacity.unitsRequired) * 100) : 0}%
          </span>
          <svg className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-card-border">
          <div className="px-4 pt-2.5 pb-1">
            <span className="text-xs text-muted">
              {satisfiedCount}/{capacity.areas.length} areas complete
              {hideSatisfied && satisfiedCount > 0 && (
                <span className="ml-1 text-info">· {satisfiedCount} satisfied hidden</span>
              )}
            </span>
          </div>

          <div className="px-4 pb-4 space-y-3 pt-1">
            {visibleAreas.map((area) => {
              const fulfilled = area.unitsFulfilled >= area.unitsRequired;
              const partial = !fulfilled && area.unitsFulfilled > 0;

              // Separate DB-backed courses from manual overrides
              // Manual overrides have title === "Manual entry" or no grade/semester
              // (A rough heuristic — we'll just show them all together)

              return (
                <div key={area.code} className={`rounded-lg border p-3 ${
                  fulfilled ? "bg-success-light border-success/20"
                    : partial ? "bg-warning-light border-warning/20"
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      fulfilled ? "bg-success text-white"
                        : partial ? "bg-warning text-white"
                        : "bg-gray-200 text-muted"
                    }`}>
                      {fulfilled ? <CheckIcon /> : partial ? <HalfIcon /> : <span className="text-[10px]">–</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-muted">{area.code}</span>
                        <p className={`text-sm font-medium flex-1 ${
                          fulfilled ? "text-success" : partial ? "text-warning" : "text-foreground"
                        }`}>{area.name}</p>
                        <span className={`text-xs font-semibold shrink-0 ${
                          fulfilled ? "text-success" : partial ? "text-warning" : "text-muted"
                        }`}>
                          {area.unitsFulfilled}/{area.unitsRequired}
                          {" · "}
                          {area.unitsRequired > 0 ? Math.round((area.unitsFulfilled / area.unitsRequired) * 100) : 0}%
                        </span>
                      </div>

                      {/* Courses satisfying this area */}
                      {area.contributingCourses.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted mb-1.5">
                            {fulfilled ? "Satisfied by:" : "Currently counting:"}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {area.contributingCourses.map((c, i) => {
                              const isManual = !c.grade && !c.semester && c.title === "Manual entry";
                              return (
                                <span key={`${c.code}-${i}`} className={`text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                                  fulfilled ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                }`}>
                                  {c.code}
                                  {c.grade ? ` · ${c.grade}` : c.semester ? ` · ${c.semester}` : ""}
                                  {isManual && (
                                    <button
                                      onClick={() => removeOverride(c.code, area.code)}
                                      className="ml-0.5 opacity-60 hover:opacity-100 text-[10px]"
                                      title="Remove manual entry"
                                    >✕</button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Suggestions for unfulfilled areas */}
                      {!fulfilled && (
                        <div className="mt-2">
                          <p className="text-xs text-muted mb-1.5">
                            {partial
                              ? `${area.unitsRequired - area.unitsFulfilled} more needed — options:`
                              : "Courses that fulfill this:"}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(suggestions[area.code] || []).slice(0, 8).map((s) => (
                              <Link key={s.code} href={`/courses/${s.slug}`}
                                className="text-[11px] bg-info-light text-info px-1.5 py-0.5 rounded hover:bg-info hover:text-white transition-colors"
                                title={s.title}>
                                {s.code}
                              </Link>
                            ))}
                            {!(suggestions[area.code] || []).length && (
                              <span className="text-[11px] text-muted italic">
                                No courses in DB — use link below or{" "}
                                <Link href={`/courses?hubArea=${area.code}`} className="text-info underline">
                                  browse
                                </Link>
                              </span>
                            )}
                          </div>

                          {/* Manual override entry */}
                          <AddOverrideForm hubCode={area.code} onAdded={refresh} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleAreas.length === 0 && (
              <p className="text-sm text-success text-center py-2">All areas fulfilled!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
