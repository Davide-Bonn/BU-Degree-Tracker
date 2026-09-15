"use client";
import SpotlightTour, { type TourStep } from "@/components/SpotlightTour";

const STEPS: TourStep[] = [
  { selector: null, title: "BU Hub Tracker", desc: "The BU Hub requires you to earn units across 11 areas grouped into 6 capacities. This page tracks all of them." },
  { selector: '[data-tour="hub-total"]', title: "Total Hub Progress", desc: "Your overall Hub unit count — fulfilled vs. total required. Every completed Hub course moves this forward." },
  { selector: '[data-tour="hub-capacity"]', title: "Hub Capacities", desc: "Each capacity (like Scientific Inquiry or Digital/Multimedia Expression) contains one or more Hub areas. Expand to see individual areas." },
  { selector: '[data-tour="hub-area-card"]', title: "Hub Area Cards", desc: "Each card shows how many units you've satisfied in that area, which courses contributed, and suggestions for what to take next." },
];

export default function HubTour() {
  return <SpotlightTour steps={STEPS} storageKey="bu_tour_hub" />;
}
