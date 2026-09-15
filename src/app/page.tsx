import { getOverallProgress } from "@/lib/progress";
import { getEffectiveUserId } from "@/lib/user";
import Link from "next/link";
import HubClient from "./hub/HubClient";
import FirstRunTour from "@/components/FirstRunTour";

function ProgressRing({
  value,
  max,
  inProgress = 0,
  size = 120,
  stroke = 10,
  label,
  sublabel,
  displayValue,
  color = "var(--accent)",
}: {
  value: number;
  max: number;
  inProgress?: number;
  size?: number;
  stroke?: number;
  label: string;
  sublabel: string;
  displayValue?: string;
  color?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const dashOffset = circumference * (1 - pct);
  const ipPct = max > 0 ? Math.min((value + inProgress) / max, 1) : 0;
  const ipDashOffset = circumference * (1 - ipPct);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#d8d6e3" strokeWidth={stroke} />
        {/* In-progress arc (faded) */}
        {inProgress > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeOpacity="0.25" strokeWidth={stroke}
            strokeDasharray={circumference} strokeDashoffset={ipDashOffset}
            strokeLinecap="round" className="transition-all duration-700"
          />
        )}
        {/* Earned arc (solid) */}
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round" className="transition-all duration-700"
        />
      </svg>
      <div className="text-center"
        style={{ marginTop: `-${size / 2 + 10}px`, marginBottom: `${size / 2 - 22}px` }}>
        <span className="text-2xl font-bold">{displayValue ?? `${value}/${max}`}</span>
        {inProgress > 0 && (
          <span className="block text-[11px] font-normal text-muted mt-0.5">+{inProgress} IP</span>
        )}
      </div>
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-xs text-muted">{sublabel}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-success-light text-success",
    "in-progress": "bg-warning-light text-warning",
    planned: "bg-info-light text-info",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || "bg-gray-100 text-muted"}`}>
      {status}
    </span>
  );
}


export default async function DashboardPage() {
  const userId = await getEffectiveUserId();
  const progress = await getOverallProgress(userId);
  const activeProgram = progress.programs.find((p) => p.isActive);

  const suggestionsByArea: Record<string, { code: string; title: string; slug: string }[]> = {};
  for (const area of progress.missingHubAreas) {
    suggestionsByArea[area.code] = area.suggestedCourses;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <FirstRunTour />
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Progress Rings */}
      <div data-tour="progress-rings" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-card-border rounded-lg p-6 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <ProgressRing
              value={progress.totalCreditsEarned}
              max={progress.totalCreditsRequired}
              inProgress={progress.totalCreditsInProgress}
              label="Credits"
              sublabel={`${progress.totalCreditsEarned} earned`}
              color="var(--accent)"
            />
            {progress.degreeType === "dual-degree" && (
              <p className="text-xs text-center text-info font-medium mt-1">Dual Degree · 144 cr</p>
            )}
            {progress.degreeType === "double-major" && (
              <p className="text-xs text-center text-muted mt-1">Double Major</p>
            )}
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-6 flex items-center justify-center">
          <ProgressRing
            value={progress.hubUnitsFulfilled}
            max={progress.hubUnitsTotal}
            label="Hub Units"
            sublabel={`${progress.hubUnitsTotal - progress.hubUnitsFulfilled} remaining`}
            color="var(--info)"
          />
        </div>
        <div className="bg-card border border-card-border rounded-lg p-6 flex items-center justify-center">
          <ProgressRing
            value={progress.gpa}
            max={4.0}
            displayValue={progress.gpa.toFixed(2)}
            label="GPA"
            sublabel="4.0 scale"
            color="var(--success)"
          />
        </div>
      </div>

      {/* Per-program school requirements — one card per active major */}
      {progress.programs
        .filter((p) => p.isActive && p.schoolRequirements.length > 0)
        .map((program) => (
          <div key={program.code} data-tour="cas-requirements" className="bg-card border border-card-border rounded-lg p-6">
            <h2 className="font-semibold mb-3">{program.name} Requirements</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {program.schoolRequirements.map((req) => (
                <div key={req.id} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    req.satisfied
                      ? "bg-success text-white"
                      : req.inProgress
                      ? "bg-warning text-white"
                      : "bg-gray-200 text-muted"
                  }`}>
                    {req.satisfied ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : req.inProgress ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                        <circle cx="12" cy="12" r="9" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <span className="text-[10px]">-</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{req.name}</p>
                    <p className="text-xs text-muted">{req.current} / {req.target}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      }

      <div data-tour="hub-section">
        <h2 className="font-semibold text-lg">Hub Requirements</h2>
        <HubClient
          hubCapacities={progress.hubCapacities}
          hubUnitsFulfilled={progress.hubUnitsFulfilled}
          hubUnitsTotal={progress.hubUnitsTotal}
          suggestions={suggestionsByArea}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* In Progress */}
        <div data-tour="in-progress" className="bg-card border border-card-border rounded-lg p-6">
          <h2 className="font-semibold mb-3">In Progress</h2>
          {progress.inProgressCourses.length === 0 ? (
            <p className="text-sm text-muted">No courses in progress.</p>
          ) : (
            <ul className="space-y-2">
              {progress.inProgressCourses.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <Link href={`/courses/${c.code.toLowerCase().replace(/\s+/g, "-")}`} className="text-sm font-medium hover:text-accent">
                    {c.code}: {c.title}
                  </Link>
                  <StatusBadge status="in-progress" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Active Program Progress */}
        {activeProgram && (
          <div className="bg-card border border-card-border rounded-lg p-6">
            <h2 className="font-semibold mb-3">{activeProgram.name}</h2>
            <div className="space-y-3">
              {activeProgram.groups.map((g) => (
                <div key={g.groupName} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-accent-light text-accent flex items-center justify-center text-sm font-bold shrink-0">
                    {g.groupName}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{g.description}</p>
                    <div className="mt-1 w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-accent transition-all"
                        style={{ width: `${g.minCourses > 0 ? Math.min((g.completedCount / g.minCourses) * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted whitespace-nowrap">
                    {g.completedCount}/{g.minCourses}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
