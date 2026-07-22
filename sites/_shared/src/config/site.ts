import type { Locale } from "../i18n/config";

/**
 * Per-site configuration. Localized fields carry one string per locale; the
 * shared theme reads them by the current language.
 */
export interface SiteCategory {
  /** Language-neutral stable key, e.g. "news". Used in frontmatter and URLs. */
  key: string;
  /** Localized labels, e.g. { en: "News", it: "Novità" }. */
  labels: Record<Locale, string>;
}

export interface SiteConfig {
  name: string;
  domain: string;
  tagline: Record<Locale, string>;
  description: Record<Locale, string>;
  brand: {
    accent: string;
    accentDark: string;
  };
  categories: SiteCategory[];
}

/** Localized label for a category key (falls back to the key itself). */
export function categoryLabel(
  site: SiteConfig,
  key: string,
  lang: Locale,
): string {
  return site.categories.find((c) => c.key === key)?.labels[lang] ?? key;
}
