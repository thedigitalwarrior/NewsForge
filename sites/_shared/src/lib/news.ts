import { getCollection, type CollectionEntry } from "astro:content";
import type { Locale } from "../i18n/config";

/**
 * Article ids look like "<lang>/<slug>" (content lives in news/<lang>/<slug>.md).
 * The slug is shared across languages — it's the translation key.
 */
export function parseNewsId(id: string): { lang: string; slug: string } {
  const [lang, ...rest] = id.split("/");
  return { lang, slug: rest.join("/") };
}

function isVisible(post: CollectionEntry<"news">): boolean {
  // Drafts show in dev (preview) and are held back in production builds.
  return import.meta.env.PROD ? !post.data.draft : true;
}

/** Visible articles for one language, newest first. */
export async function getVisibleNews(
  lang: Locale,
): Promise<CollectionEntry<"news">[]> {
  const posts = await getCollection("news");
  return posts
    .filter((p) => parseNewsId(p.id).lang === lang && isVisible(p))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/** Which locales have a visible version of this slug (for switcher + hreflang). */
export async function getNewsTranslations(slug: string): Promise<Locale[]> {
  const posts = await getCollection("news");
  const langs = posts
    .filter((p) => parseNewsId(p.id).slug === slug && isVisible(p))
    .map((p) => parseNewsId(p.id).lang as Locale);
  return [...new Set(langs)];
}
