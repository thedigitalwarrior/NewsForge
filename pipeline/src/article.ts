import { z } from "zod/v4";

/**
 * Shape the LLM must produce for the canonical (English) article. Mirrors the
 * frontmatter contract in sites/_shared/src/content/config.ts (keep in sync),
 * plus `body`. `pubDate` and `draft` are added by the pipeline, not the model.
 */
export interface ArticleDraft {
  title: string;
  description: string;
  category: string;
  body: string;
  sources: string[];
}

/** Build a per-site output schema whose `category` is constrained to the site's keys. */
export function buildArticleSchema(categories: readonly [string, ...string[]]) {
  return z.object({
    title: z.string().describe("Article title: clear, no clickbait"),
    description: z
      .string()
      .describe("One-sentence summary, used as the meta description"),
    category: z
      .enum(categories)
      .describe("Language-neutral category key for this article"),
    body: z
      .string()
      .describe(
        "Article body as English Markdown. No H1 title and no frontmatter: just the text with ## subheadings.",
      ),
    sources: z
      .array(z.url())
      .min(1)
      .describe("URLs of the sources actually used"),
  });
}
