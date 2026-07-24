/**
 * Sites the pipeline can target. Categories are the language-neutral KEYS used in
 * frontmatter (labels are localized in each site's own config — keep in sync).
 * Articles are generated in the canonical locale and translated into the targets.
 */
export interface SiteDefinition {
  slug: string;
  name: string;
  /** Language articles are written in (the canonical version). */
  canonicalLocale: string;
  /** Locales the canonical gets translated into. */
  targetLocales: string[];
  categories: readonly [string, ...string[]];
  defaultSourceHints: string[];
  /**
   * Editorial beats: the queries the discovery step runs against the search
   * engine. They define what the site covers — widen or narrow them at will.
   */
  searchQueries: string[];
  /**
   * Short topic description. Candidates are kept only if their embedding is close
   * enough to this anchor — the relevance gate that drops off-topic search noise.
   */
  topicAnchor: string;
}

/** Human-readable language names, for the translation prompt. */
export const localeNames: Record<string, string> = {
  en: "English",
  it: "Italian",
};

export const sites: Record<string, SiteDefinition> = {
  tabletnexus: {
    slug: "tabletnexus",
    name: "TabletNexus",
    canonicalLocale: "en",
    targetLocales: ["it"],
    categories: ["news", "comparisons", "prices", "guides", "accessories"],
    defaultSourceHints: [
      "apple.com/newsroom",
      "anandtech.com",
      "gsmarena.com",
      "notebookcheck.net",
      "theverge.com",
    ],
    searchQueries: [
      "tablet announcement",
      "iPad news",
      "Samsung Galaxy Tab",
      "Android tablet launch",
      "e-ink tablet",
      "tablet price drop",
    ],
    topicAnchor:
      "Tablets: iPad, Android tablets, Samsung Galaxy Tab, e-ink tablets, tablet reviews, comparisons, prices, deals and accessories.",
  },
};

export function getSite(slug: string): SiteDefinition {
  const site = sites[slug];
  if (!site) {
    throw new Error(
      `Sito sconosciuto: "${slug}". Disponibili: ${Object.keys(sites).join(", ")}.`,
    );
  }
  return site;
}
