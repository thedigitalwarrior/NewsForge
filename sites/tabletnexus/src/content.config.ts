import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { newsSchema } from "@shared/content/config";

/**
 * During theme development the `news` collection is fed by the shared fixtures
 * (sites/_shared/fixtures), NOT by this site's own src/content/news/ — that
 * folder stays untouched by hand until the pipeline writes real articles.
 * See the "Convenzioni" section of the root CLAUDE.md.
 */
const news = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "../_shared/fixtures",
  }),
  schema: newsSchema,
});

export const collections = { news };
