"use client";
import SpotlightTour, { type TourStep } from "@/components/SpotlightTour";

const STEPS: TourStep[] = [
  { selector: null, title: "Semester Planner", desc: "Organize your courses semester by semester. Drag and plan ahead, check for conflicts, and see prereqs before you enroll." },
  { selector: '[data-tour="planner-columns"]', title: "Semester Columns", desc: "Each column is one semester. Add courses to a semester to plan your schedule. Completed semesters show your actual grades." },
  { selector: '[data-tour="planner-summary"]', title: "Running Totals", desc: "See credits, Hub units, and GPA update in real time as you move courses between semesters." },
];

export default function PlannerTour() {
  return <SpotlightTour steps={STEPS} storageKey="bu_tour_planner" />;
}
