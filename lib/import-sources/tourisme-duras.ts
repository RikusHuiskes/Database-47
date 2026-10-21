import { inferEventCategorySlug, type ExternalEventSource } from "../import-sources";
import { fetchTourismeDurasEvents } from "../tourisme-duras-source";

export function createTourismeDurasSource(
  persist: ExternalEventSource["persistPendingEvent"],
): ExternalEventSource {
  return {
    id: "tourisme-duras",
    name: "Tourisme Duras",
    fetchEvents: fetchTourismeDurasEvents,
    categorySlugFor: inferEventCategorySlug,
    persistPendingEvent: persist,
  };
}
