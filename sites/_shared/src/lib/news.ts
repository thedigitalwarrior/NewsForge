import { getCollection, type CollectionEntry } from "astro:content";

/**
 * Single chokepoint for "which news are visible on the site", used by the
 * homepage, category pages, RSS and sitemap so they never drift apart.
 *
 * NOTE: during theme development every fixture is `draft: true`, so for now we
 * show everything. When the pipeline/publishing flow lands (roadmap fase 6),
 * flip this to exclude drafts by uncommenting the filter below.
 */
export async function getVisibleNews(): Promise<CollectionEntry<"news">[]> {
  const posts = await getCollection("news");
  return posts
    // .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}
