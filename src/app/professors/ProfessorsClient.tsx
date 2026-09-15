"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Professor {
  id: number;
  name: string;
  rmpId: string;
  avgRating: number;
  avgDifficulty: number;
  numRatings: number;
  wouldTakeAgainPct: number;
  department: string;
}

type SortField = "rating" | "numRatings" | "difficulty" | "wouldTakeAgain" | "none";
type SortDir = "desc" | "asc";

function RatingBadge({ value, max = 5, label }: { value: number; max?: number; label: string }) {
  const pct = max > 0 ? value / max : 0;
  const color =
    pct >= 0.8 ? "text-success" : pct >= 0.6 ? "text-warning" : "text-accent";
  return (
    <div className="text-center min-w-[52px]">
      <p className={`font-bold text-base leading-none ${color}`}>
        {max === 100 ? `${Math.round(value)}%` : value.toFixed(1)}
      </p>
      <p className="text-[10px] text-muted mt-0.5">{label}</p>
    </div>
  );
}

const selectClass =
  "px-3 py-1.5 border border-card-border rounded-md text-sm bg-card w-full focus:outline-none focus:ring-1 focus:ring-accent";
const labelClass = "text-xs text-muted mb-1 block font-medium";

export default function ProfessorsClient({
  professors,
  departments,
}: {
  professors: Professor[];
  departments: string[];
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [sortField, setSortField] = useState<SortField>("rating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [minRatings, setMinRatings] = useState(0);

  const filtered = useMemo(() => {
    let list = [...professors];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q)
      );
    }

    if (department) {
      list = list.filter((p) => p.department === department);
    }

    if (minRatings > 0) {
      list = list.filter((p) => p.numRatings >= minRatings);
    }

    if (sortField !== "none") {
      list.sort((a, b) => {
        let av = 0,
          bv = 0;
        switch (sortField) {
          case "rating":
            av = a.avgRating;
            bv = b.avgRating;
            break;
          case "numRatings":
            av = a.numRatings;
            bv = b.numRatings;
            break;
          case "difficulty":
            av = a.avgDifficulty;
            bv = b.avgDifficulty;
            break;
          case "wouldTakeAgain":
            av = a.wouldTakeAgainPct;
            bv = b.wouldTakeAgainPct;
            break;
        }
        return sortDir === "desc" ? bv - av : av - bv;
      });
    }

    return list;
  }, [professors, search, department, sortField, sortDir, minRatings]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div data-tour="professors-search" className="bg-card border border-card-border rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div>
          <label className={labelClass}>Search Name</label>
          <input
            type="text"
            placeholder="Professor name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={selectClass}
          />
        </div>

        <div>
          <label className={labelClass}>Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={selectClass}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Min. Reviews</label>
          <select
            value={minRatings}
            onChange={(e) => setMinRatings(Number(e.target.value))}
            className={selectClass}
          >
            <option value={0}>Any</option>
            <option value={5}>5+</option>
            <option value={10}>10+</option>
            <option value={25}>25+</option>
            <option value={50}>50+</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Sort By</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className={selectClass}
          >
            <option value="rating">Rating</option>
            <option value="numRatings">Number of Reviews</option>
            <option value="difficulty">Difficulty</option>
            <option value="wouldTakeAgain">Would Take Again %</option>
            <option value="none">No Sort</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Order</label>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as SortDir)}
            className={selectClass}
          >
            <option value="desc">Highest First ↓</option>
            <option value="asc">Lowest First ↑</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-muted">{filtered.length} professors</p>

      {/* Professor list */}
      <div data-tour="professors-list" className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted text-sm border border-dashed border-card-border rounded-lg">
            {professors.length === 0
              ? "No professor data yet. Run the RMP scraper to populate."
              : "No professors match your filters."}
          </div>
        )}

        {filtered.map((prof, idx) => (
          <Link
            key={prof.id}
            href={`/professors/${prof.id}`}
            className="bg-card border border-card-border rounded-lg px-4 py-3 flex items-center gap-4 hover:border-accent/30 transition-colors"
          >
            {/* Rank */}
            <div className="w-7 text-center shrink-0">
              <span className="text-xs font-bold text-muted">#{idx + 1}</span>
            </div>

            {/* Name + dept */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{prof.name}</p>
              {prof.department && (
                <p className="text-xs text-muted truncate">{prof.department}</p>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-5 shrink-0">
              <RatingBadge value={prof.avgRating} max={5} label="Rating" />

              <div className="hidden sm:block">
                <RatingBadge
                  value={prof.avgDifficulty}
                  max={5}
                  label="Difficulty"
                />
              </div>

              {prof.wouldTakeAgainPct >= 0 && (
                <div className="hidden md:block">
                  <RatingBadge
                    value={prof.wouldTakeAgainPct}
                    max={100}
                    label="Take Again"
                  />
                </div>
              )}

              <div className="text-center min-w-[48px]">
                <p className="font-semibold text-sm leading-none">
                  {prof.numRatings}
                </p>
                <p className="text-[10px] text-muted mt-0.5">Reviews</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
