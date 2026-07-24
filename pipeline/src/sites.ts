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
   * Editorial scope, in prose, for the LLM relevance filter: what belongs on this
   * site and what does not. This is a judgment call, so it's the LLM's job — not
   * embedding similarity, which conflates surface features (a foldable *phone*
   * looks close to "Galaxy Tab"; a WhatsApp-for-iPad story looks like an app).
   */
  editorialScope: string;
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
    editorialScope: [
      "ON TOPIC: news about TABLETS — iPad and iPadOS; Android tablets (Samsung Galaxy Tab, Lenovo, Xiaomi, Huawei MatePad, Honor, Teclast, OnePlus Pad, Moto Pad, etc.); Windows tablets; e-ink/e-paper tablets. Their launches, hardware, software updates, reviews, prices, deals, comparisons, and tablet accessories (keyboards, pens). A story about an app or feature counts only if it is specifically about the tablet experience.",
      "OFF TOPIC: smartphones and foldable phones (e.g. Galaxy Z Fold, iPhone), smartwatches, laptops and Macs, TVs, generic apps, and anything not primarily about tablets (business, politics, science, world news).",
    ].join(" "),
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
