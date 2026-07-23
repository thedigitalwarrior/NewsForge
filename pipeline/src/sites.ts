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
