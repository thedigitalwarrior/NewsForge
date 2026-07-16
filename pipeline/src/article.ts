import { z } from "zod/v4";

/**
 * Shape the LLM must produce. Mirrors the frontmatter contract in
 * sites/_shared/src/content/config.ts (keep in sync), plus `body`.
 * `pubDate` and `draft` are added by the pipeline, not by the model.
 */
export interface ArticleDraft {
  title: string;
  description: string;
  category: string;
  body: string;
  sources: string[];
}

/** Build a per-site output schema whose `category` is constrained to the site's set. */
export function buildArticleSchema(categories: readonly [string, ...string[]]) {
  return z.object({
    title: z.string().describe("Titolo dell'articolo, chiaro e senza clickbait"),
    description: z
      .string()
      .describe("Sintesi in una frase, usata come meta description"),
    category: z.enum(categories).describe("Categoria dell'articolo"),
    body: z
      .string()
      .describe(
        "Corpo dell'articolo in Markdown italiano. Niente titolo H1 e niente frontmatter: solo il testo con sottotitoli ##.",
      ),
    sources: z
      .array(z.url())
      .min(1)
      .describe("URL delle fonti effettivamente usate"),
  });
}
