"use client";
import SpotlightTour, { type TourStep } from "@/components/SpotlightTour";

const STEPS: TourStep[] = [
  { selector: null, title: "Professor Ratings", desc: "RateMyProfessors data for every BU instructor — so you can pick the best section before enrolling." },
  { selector: '[data-tour="professors-search"]', title: "Search & Filter", desc: "Search by name or filter by department to find a specific professor quickly." },
  { selector: '[data-tour="professors-list"]', title: "Professor Cards", desc: "Each card shows the average rating, difficulty, and % of students who'd take them again. Click a card to read individual reviews." },
];

export default function ProfessorsTour() {
  return <SpotlightTour steps={STEPS} storageKey="bu_tour_professors" />;
}
