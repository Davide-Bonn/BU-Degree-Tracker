"use client";
import SpotlightTour, { type TourStep } from "@/components/SpotlightTour";

const STEPS: TourStep[] = [
  { selector: null, title: "Programs & Minors", desc: "Every BU program in one place. Track your major, add minors, or explore joint majors to see how your courses apply." },
  { selector: '[data-tour="programs-list"]', title: "Program List", desc: "All majors, minors, and joint majors are listed here. Each card shows your completion progress at a glance." },
  { selector: '[data-tour="programs-overlap"]', title: "Course Overlap", desc: "If you're tracking multiple programs, this section shows which courses count toward more than one — great for double majors and minors." },
];

export default function ProgramsTour() {
  return <SpotlightTour steps={STEPS} storageKey="bu_tour_programs" />;
}
