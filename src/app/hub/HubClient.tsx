"use client";

import { useState } from "react";
import HubCapacitySection from "./HubCapacitySection";
import type { HubCapacityProgress } from "@/lib/progress";
import { CAPACITY_COLORS } from "@/lib/constants";

export default function HubClient({
  hubCapacities,
  hubUnitsFulfilled,
  hubUnitsTotal,
  suggestions,
}: {
  hubCapacities: HubCapacityProgress[];
  hubUnitsFulfilled: number;
  hubUnitsTotal: number;
  suggestions: Record<string, { code: string; title: string; slug: string }[]>;
}) {
  const [hideSatisfied, setHideSatisfied] = useState(false);

  const totalAreas = hubCapacities.reduce((s, c) => s + c.areas.length, 0);
  const satisfiedAreas = hubCapacities.reduce(
    (s, c) => s + c.areas.filter((a) => a.unitsFulfilled >= a.unitsRequired).length,
    0
  );
  const missingAreas = totalAreas - satisfiedAreas;

  // When hiding satisfied: skip capacities that are entirely done
  const visibleCapacities = hideSatisfied
    ? hubCapacities.filter((c) => c.unitsFulfilled < c.unitsRequired)
    : hubCapacities;

  return (
    <div className="space-y-6">
      {/* Overall progress bar + global toggle */}
      <div data-tour="hub-capacity" className="space-y-2">
        <div className="flex items-end justify-between mb-1">
          <span className="text-sm text-muted">
            {satisfiedAreas}/{totalAreas} areas complete
          </span>
          <span className={`text-2xl font-bold tabular-nums ${
            satisfiedAreas === totalAreas ? "text-success" : "text-info"
          }`}>
            {totalAreas > 0 ? Math.round((satisfiedAreas / totalAreas) * 100) : 0}%
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${satisfiedAreas === totalAreas ? "bg-success" : "bg-info"}`}
            style={{ width: `${totalAreas > 0 ? (satisfiedAreas / totalAreas) * 100 : 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            {hubUnitsFulfilled}/{hubUnitsTotal} units · {missingAreas} area{missingAreas !== 1 ? "s" : ""} still needed
            {hideSatisfied && missingAreas > 0 && (
              <span className="ml-2 text-accent font-medium">· showing {missingAreas} missing</span>
            )}
          </span>
          <button
            onClick={() => setHideSatisfied((v) => !v)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              hideSatisfied
                ? "bg-accent text-white"
                : "bg-gray-100 text-muted hover:bg-gray-200"
            }`}
          >
            {hideSatisfied ? "Show all" : "Hide satisfied"}
          </button>
        </div>
      </div>

      {/* Capacity sections */}
      <div data-tour="hub-area-card" className="space-y-4">
        {visibleCapacities.map((cap) => (
          <HubCapacitySection
            key={cap.capacity}
            capacity={cap}
            suggestions={suggestions}
            hideSatisfied={hideSatisfied}
            color={CAPACITY_COLORS[cap.capacity]}
          />
        ))}
        {visibleCapacities.length === 0 && (
          <div className="text-center py-12 text-success">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-semibold">All hub requirements satisfied!</p>
          </div>
        )}
      </div>
    </div>
  );
}
