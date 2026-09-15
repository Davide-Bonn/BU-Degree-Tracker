import { getOverallProgress } from "@/lib/progress";
import { TOTAL_HUB_UNITS_REQUIRED } from "@/lib/constants";
import { getEffectiveUserId } from "@/lib/user";
import HubClient from "./HubClient";
import HubTour from "./HubTour";


export default async function HubPage() {
  const userId = await getEffectiveUserId();

  const progress = await getOverallProgress(userId);

  // Build suggestions map from data already computed in getOverallProgress
  const suggestionsByArea: Record<string, { code: string; title: string; slug: string }[]> = {};
  for (const area of progress.missingHubAreas) {
    suggestionsByArea[area.code] = area.suggestedCourses;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <HubTour />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">BU Hub Progress</h1>
        <div data-tour="hub-total" className="text-sm">
          <span className="font-semibold text-lg">{progress.hubUnitsFulfilled}</span>
          <span className="text-muted">/{TOTAL_HUB_UNITS_REQUIRED} units fulfilled</span>
        </div>
      </div>

      <HubClient
        hubCapacities={progress.hubCapacities}
        hubUnitsFulfilled={progress.hubUnitsFulfilled}
        hubUnitsTotal={progress.hubUnitsTotal}
        suggestions={suggestionsByArea}
      />
    </div>
  );
}
