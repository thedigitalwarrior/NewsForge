import type { ArticleDraft } from "../article.js";
import type { GenerationRequest, GenerationResult, LLMProvider } from "./types.js";

/**
 * Offline provider that returns a deterministic draft without calling any model.
 * Lets us exercise the whole pipeline (research → synthesis → validation → write)
 * with no API key and no cost — handy for tests and local development.
 */
export function createMockProvider(): LLMProvider {
  return {
    name: "mock",
    async generate(req: GenerationRequest): Promise<GenerationResult> {
      const category = req.categories[0] ?? "Novità";
      const sources = req.sources.length
        ? req.sources.map((s) => s.url)
        : ["https://example.com/fonte-di-prova"];

      const bodyParts = [
        "Questo articolo è una **bozza deterministica** prodotta dal provider `mock`, senza chiamare alcun modello. Serve a verificare la pipeline dall'inizio alla fine.",
        "",
        "## Contesto",
        "",
        req.sources.length
          ? `Il materiale proviene da ${req.sources.length} fonte/i recuperate dalla pipeline.`
          : "Nessuna fonte è stata recuperata: contenuto puramente segnaposto.",
        "",
        "## Dettagli",
        "",
        "Il corpo è Markdown italiano con sottotitoli, così da esercitare il rendering del tema (prose, componenti) come un articolo reale.",
      ];

      const draft: ArticleDraft = {
        title: "Bozza di prova dalla pipeline NewsForge",
        description:
          "Articolo segnaposto generato dal provider mock per validare la catena senza costi né chiave API.",
        category,
        body: bodyParts.join("\n"),
        sources,
      };

      return { draft, usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
}
