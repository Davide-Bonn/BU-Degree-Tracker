"use client";
import SpotlightTour, { type TourStep } from "@/components/SpotlightTour";

const STEPS: TourStep[] = [
  { selector: null, title: "Course Browser", desc: "Browse every BU course in the catalog. Search, filter, and mark courses as you go." },
  { selector: '[data-tour="course-filters"]', title: "Search & Filters", desc: "Filter by name, department, Hub area, semester, days, instructor, and more to find exactly what you need." },
  { selector: '[data-tour="course-grid"]', title: "Course Cards", desc: "Each card shows the course code, title, Hub areas it satisfies, when it's offered, and its current status." },
  { selector: '[data-tour="course-first-card"]', title: "Tracking a Course", desc: "Click the ⊕ button on any card to mark it Completed, In Progress, or Planned — your dashboard updates instantly." },
];

export default function CoursesTour() {
  return <SpotlightTour steps={STEPS} storageKey="bu_tour_courses" />;
}
