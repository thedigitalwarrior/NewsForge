import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getVisibleNews } from "@shared/lib/news";
import { site } from "../config/site";

export async function GET(context: APIContext) {
  const posts = await getVisibleNews();
  return rss({
    title: site.name,
    description: site.description,
    site: context.site ?? `https://${site.domain}`,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/news/${post.id}/`,
      categories: [post.data.category],
    })),
    customData: `<language>it-it</language>`,
  });
}
