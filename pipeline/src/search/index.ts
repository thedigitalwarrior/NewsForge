import { createBraveSearchProvider } from "./brave.js";
import type { SearchProvider } from "./types.js";

export const availableSearchProviders = ["brave"] as const;

/**
 * Resolve the search backend. To add another engine (NewsData, Tavily, a SERP
 * provider…), implement SearchProvider in a new file and register it here — the
 * discovery loop is engine-agnostic.
 */
export function getSearchProvider(name = "brave"): SearchProvider {
  switch (name) {
    case "brave":
      return createBraveSearchProvider();
    default:
      throw new Error(
        `Motore di ricerca sconosciuto: "${name}". Disponibili: ${availableSearchProviders.join(", ")}.`,
      );
  }
}
