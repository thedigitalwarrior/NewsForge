import { z } from "astro/zod";

/**
 * Shared frontmatter schema for the news collection, used by every news site
 * in the network. Single source of truth: sites import `newsSchema` and wire it
 * into their own `content.config.ts` (Astro requires the collection definition
 * to live inside each project).
 *
 * Fields mirror the contract documented in the root CLAUDE.md. The pipeline
 * MUST emit `draft: true`; publishing is a separate human decision.
 */
export const newsSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    pubDate: z.coerce.date(),
    /** Per-site categories; kept as a free string here and constrained per site. */
    category: z.string().min(1),
    /** Optional lead image (local path or remote URL). Requires imageAlt when set. */
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    /** Source URLs backing the article. Content policy: always cite sources. */
    sources: z.array(z.string().url()).default([]),
    draft: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.image && !data.imageAlt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "imageAlt is required when image is set",
        path: ["imageAlt"],
      });
    }
  });

export type News = z.infer<typeof newsSchema>;
