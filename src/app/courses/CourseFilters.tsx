"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { HUB_CAPACITIES } from "@/lib/constants";

const CAPACITY_SHORT: Record<string, string> = {
  "Philosophical, Aesthetic, and Historical Interpretation": "Philosophical & Historical",
  "Scientific and Social Inquiry": "Scientific & Social Inquiry",
  "Quantitative Reasoning": "Quantitative Reasoning",
  "Diversity, Civic Engagement, and Global Citizenship": "Diversity & Global Citizenship",
  "Communication": "Communication",
  "Intellectual Toolkit": "Intellectual Toolkit",
};

const DAYS_OPTIONS = ["M", "T", "W", "R", "F", "S", "Su"];
const CAREER_OPTIONS = ["Undergraduate", "Graduate", "Law"];
const INSTRUCTION_MODE_OPTIONS = ["In Person", "Online"];

const inputClass =
  "px-3 py-1.5 border border-card-border rounded-md text-sm bg-card w-full focus:outline-none focus:ring-1 focus:ring-accent";
const selectClass = inputClass;
const labelClass = "text-xs text-secondary mb-1 block";

export default function CourseFilters({
  hubAreas,
  departments,
  schools,
  semesters,
  locations,
}: {
  hubAreas: { code: string; name: string; capacity: string }[];
  departments: string[];
  schools?: string[];
  semesters: string[];
  locations?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state for text inputs — keeps typing responsive while URL push is debounced
  const [searchText, setSearchText] = useState(searchParams.get("search") || "");
  const [catalogNumber, setCatalogNumber] = useState(searchParams.get("catalogNumber") || "");
  const [instructorLastName, setInstructorLastName] = useState(searchParams.get("instructorLastName") || "");
  const [units, setUnits] = useState(searchParams.get("units") || "");

  // Sync local state when URL changes (e.g. back/forward navigation)
  useEffect(() => { setSearchText(searchParams.get("search") || ""); }, [searchParams.get("search")]);
  useEffect(() => { setCatalogNumber(searchParams.get("catalogNumber") || ""); }, [searchParams.get("catalogNumber")]);
  useEffect(() => { setInstructorLastName(searchParams.get("instructorLastName") || ""); }, [searchParams.get("instructorLastName")]);
  useEffect(() => { setUnits(searchParams.get("units") || ""); }, [searchParams.get("units")]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/courses?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Debounced version for text inputs — waits 400 ms after the user stops typing
  const updateParamDebounced = useCallback(
    (key: string, value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateParam(key, value);
      }, 400);
    },
    [updateParam]
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {/* Semester (specific term) */}
      <div>
        <label className={labelClass}>Term</label>
        <select
          value={searchParams.get("semester") || ""}
          onChange={(e) => updateParam("semester", e.target.value)}
          className={selectClass}
        >
          <option value="">Any Term</option>
          {semesters.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Season: Fall / Spring / Summer */}
      <div>
        <label className={labelClass}>Season Offered</label>
        <select
          value={searchParams.get("season") || ""}
          onChange={(e) => updateParam("season", e.target.value)}
          className={selectClass}
        >
          <option value="">Any Season</option>
          <option value="Fall">Fall</option>
          <option value="Spring">Spring</option>
          <option value="Summer">Summer</option>
        </select>
      </div>

      {/* Instruction Mode (online / in-person / hybrid) */}
      <div>
        <label className={labelClass}>Instruction Mode</label>
        <select
          value={searchParams.get("instructionMode") || ""}
          onChange={(e) => updateParam("instructionMode", e.target.value)}
          className={selectClass}
        >
          <option value="">All Modes</option>
          {INSTRUCTION_MODE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* School/College */}
      <div>
        <label className={labelClass}>School/College</label>
        <select
          value={searchParams.get("school") || ""}
          onChange={(e) => updateParam("school", e.target.value)}
          className={selectClass}
        >
          <option value="">All Schools</option>
          {(schools ?? []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Subject (department) */}
      <div>
        <label className={labelClass}>Subject</label>
        <select
          value={searchParams.get("department") || ""}
          onChange={(e) => updateParam("department", e.target.value)}
          className={selectClass}
        >
          <option value="">All Subjects</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Catalog Number */}
      <div>
        <label className={labelClass}>Catalog Number</label>
        <input
          type="text"
          placeholder="e.g. 101"
          value={catalogNumber}
          onChange={(e) => {
            setCatalogNumber(e.target.value);
            updateParamDebounced("catalogNumber", e.target.value);
          }}
          className={inputClass}
        />
      </div>

      {/* Keyword */}
      <div>
        <label className={labelClass}>Keyword</label>
        <input
          type="text"
          placeholder="Name, code, or hub area…"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            updateParamDebounced("search", e.target.value);
          }}
          className={inputClass}
        />
      </div>

      {/* Career */}
      <div>
        <label className={labelClass}>Career</label>
        <select
          value={searchParams.get("career") || ""}
          onChange={(e) => updateParam("career", e.target.value)}
          className={selectClass}
        >
          <option value="">All Careers</option>
          {CAREER_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Days */}
      <div>
        <label className={labelClass}>Days</label>
        <div className="flex flex-wrap gap-1">
          {DAYS_OPTIONS.map((d) => {
            const selectedDays = (searchParams.get("days") || "")
              .split(",")
              .filter(Boolean);
            const isActive = selectedDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  const next = isActive
                    ? selectedDays.filter((x) => x !== d)
                    : [...selectedDays, d];
                  updateParam("days", next.join(","));
                }}
                className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                  isActive
                    ? "bg-accent text-white border-accent"
                    : "bg-card border-card-border text-secondary hover:border-accent/50"
                }`}
                aria-pressed={isActive}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Time */}
      <div>
        <label className={labelClass}>Start Time &gt;=</label>
        <input
          type="time"
          value={searchParams.get("startTime") || ""}
          onChange={(e) => updateParam("startTime", e.target.value)}
          className={inputClass}
        />
      </div>

      {/* End Time */}
      <div>
        <label className={labelClass}>End Time &lt;=</label>
        <input
          type="time"
          value={searchParams.get("endTime") || ""}
          onChange={(e) => updateParam("endTime", e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Location */}
      <div>
        <label className={labelClass}>Location</label>
        <select
          value={searchParams.get("location") || ""}
          onChange={(e) => updateParam("location", e.target.value)}
          className={selectClass}
        >
          <option value="">All Locations</option>
          {(locations ?? []).map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {/* Instructor Last Name */}
      <div>
        <label className={labelClass}>Instructor Last Name</label>
        <input
          type="text"
          value={instructorLastName}
          onChange={(e) => {
            setInstructorLastName(e.target.value);
            updateParamDebounced("instructorLastName", e.target.value);
          }}
          className={inputClass}
        />
      </div>

      {/* Units */}
      <div>
        <label className={labelClass}>Units</label>
        <input
          type="text"
          placeholder="e.g. 4"
          value={units}
          onChange={(e) => {
            setUnits(e.target.value);
            updateParamDebounced("units", e.target.value);
          }}
          className={inputClass}
        />
      </div>

      {/* Hub area — multi-select toggles */}
      <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6">
        <label className={labelClass}>Hub Areas</label>
        <div className="flex flex-wrap gap-1">
          {HUB_CAPACITIES.map((cap) => {
            const areasInCap = hubAreas.filter((h) => h.capacity === cap);
            if (areasInCap.length === 0) return null;
            return areasInCap.map((h) => {
              const selectedHubs = (searchParams.get("hubArea") || "")
                .split(",")
                .filter(Boolean);
              const isActive = selectedHubs.includes(h.code);
              return (
                <button
                  key={h.code}
                  type="button"
                  title={h.name}
                  onClick={() => {
                    const next = isActive
                      ? selectedHubs.filter((x) => x !== h.code)
                      : [...selectedHubs, h.code];
                    updateParam("hubArea", next.join(","));
                  }}
                  className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                    isActive
                      ? "bg-info text-white border-info"
                      : "bg-card border-card-border text-secondary hover:border-info/50"
                  }`}
                  aria-pressed={isActive}
                >
                  {h.code}
                </button>
              );
            });
          })}
        </div>
      </div>

      {/* Status */}
      <div>
        <label className={labelClass}>Status</label>
        <select
          value={searchParams.get("status") || ""}
          onChange={(e) => updateParam("status", e.target.value)}
          className={selectClass}
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="in-progress">In Progress</option>
          <option value="planned">Planned</option>
          <option value="not-started">Not Started</option>
        </select>
      </div>

      {/* Level */}
      <div>
        <label className={labelClass}>Level</label>
        <select
          value={searchParams.get("level") || ""}
          onChange={(e) => updateParam("level", e.target.value)}
          className={selectClass}
        >
          <option value="">All Levels</option>
          <option value="100">100-level</option>
          <option value="200">200-level</option>
          <option value="300+">300+ level</option>
        </select>
      </div>
    </div>
  );
}
