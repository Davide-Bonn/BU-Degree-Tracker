"use client";
import SpotlightTour, { type TourStep } from "./SpotlightTour";

const STEPS: TourStep[] = [
  { selector: null, title: "Welcome to University Tracker", desc: "Quick tour of what everything does. Click Next to walk through each section, or Skip to dive straight in." },
  { selector: '[data-tour="sidebar"]', title: "Navigation", desc: "Jump between Dashboard, Courses, BU Hub, Degree requirements, Semester Planner, Programs, and Professor ratings." },
  { selector: '[data-tour="progress-rings"]', title: "Your Progress", desc: "Credits earned, BU Hub units, and GPA — all three update automatically every time you mark a course as completed." },
  { selector: '[data-tour="cas-requirements"]', title: "Graduation Checklist", desc: "CAS-specific requirements: 128 total credits, minimum 2.0 GPA, a second language, and one lab science course." },
  { selector: '[data-tour="hub-section"]', title: "BU Hub Tracker", desc: "BU requires units across 11 areas like Writing, Quantitative Reasoning, and Global Citizenship. The app credits each area automatically." },
  { selector: '[data-tour="in-progress"]', title: "Log Your Courses", desc: "Go to Courses to mark any BU course as Completed, In Progress, or Planned. It shows up here and feeds every metric." },
];

export default function FirstRunTour() {
  return <SpotlightTour steps={STEPS} storageKey="bu_tour_v4" />;
}
