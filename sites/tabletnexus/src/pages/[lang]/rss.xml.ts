import rss from "@astrojs/rss";
import type { APIContext, GetStaticPaths } from "astro";
import { getVisibleNews, parseNewsId } from "@shared/lib/news";
import { locales, type Locale } from "@shared/i18n/config";
import { articleUrl } from "@shared/i18n/routes";
import { site } from "../../config/site";

export const getStaticPaths = (async () => {
  return locales.map((lang) => ({ params: { lang } }));
}) satisfies GetStaticPaths;

export async function GET(context: APIContext) {
  const lang = context.params.lang as Locale;
  const posts = await getVisibleNews(lang);
  return rss({
    title: site.name,
    description: site.description[lang],
    site: context.site ?? `https://${site.domain}`,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: articleUrl(lang, parseNewsId(post.id).slug),
      categories: [post.data.category],
    })),
    customData: `<language>${lang}</language>`,
  });
}
