import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { newsSchema } from "@shared/content/config";

/**
 * The `news` collection reads this site's real articles, written by the pipeline
 * (or migrated seed content) as draft-first Markdown/MDX. Visibility (which
 * drafts render) is decided by getVisibleNews() in @shared/lib/news — drafts show
 * in dev for review preview and are held back in production builds.
 */
const news = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/news",
  }),
  schema: newsSchema,
});

export const collections = { news };
