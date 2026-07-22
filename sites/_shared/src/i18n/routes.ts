import type { Locale } from "./config";

// All URLs are locale-prefixed and symmetric: /en/…, /it/…
// Path segments stay in English by convention; only content and labels localize.

export const homeUrl = (lang: Locale): string => `/${lang}/`;
export const articleUrl = (lang: Locale, slug: string): string =>
  `/${lang}/news/${slug}/`;
export const categoryUrl = (lang: Locale, key: string): string =>
  `/${lang}/category/${key}/`;
export const aboutUrl = (lang: Locale): string => `/${lang}/about/`;
export const searchUrl = (lang: Locale): string => `/${lang}/search/`;
export const rssUrl = (lang: Locale): string => `/${lang}/rss.xml`;
