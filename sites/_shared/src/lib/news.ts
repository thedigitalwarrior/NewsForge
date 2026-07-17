import { getCollection, type CollectionEntry } from "astro:content";

/**
 * Single chokepoint for "which news are visible on the site", used by the
 * homepage, category pages, article routes, RSS and sitemap so they never drift.
 *
 * Drafts are the review queue: shown in dev (so a reviewer can preview a draft
 * in the browser before publishing) and held back in production builds. The
 * pipeline writes draft: true; publishing flips the flag (see pipeline `publish`).
 */
export async function getVisibleNews(): Promise<CollectionEntry<"news">[]> {
  const posts = await getCollection("news");
  const visible = import.meta.env.PROD
    ? posts.filter((post) => !post.data.draft)
    : posts;
  return visible.sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );
}
