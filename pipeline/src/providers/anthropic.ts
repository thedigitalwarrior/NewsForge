import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ArticleDraft } from "../article.js";
import type { GenerationRequest, GenerationResult, LLMProvider } from "./types.js";

export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string;
}

/**
 * Claude backend. Research is already done by the pipeline, so this is a single
 * structured synthesis call — matching the "one well-structured call per article"
 * economics in pipeline/CLAUDE.md. No tools, no web search.
 */
export function createAnthropicProvider(
  opts: AnthropicProviderOptions = {},
): LLMProvider {
  const model = opts.model ?? process.env.PIPELINE_MODEL ?? "claude-sonnet-5";
  // Constructor resolves ANTHROPIC_API_KEY from the environment when apiKey is unset.
  const client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});

  return {
    name: `anthropic:${model}`,
    async generate(req: GenerationRequest): Promise<GenerationResult> {
      const response = await client.messages.parse({
        model,
        max_tokens: 8000,
        system: req.system,
        thinking: { type: "adaptive" },
        output_config: {
          format: zodOutputFormat(req.schema),
          effort: "medium",
        },
        messages: [{ role: "user", content: req.instructions }],
      });

      if (response.stop_reason === "refusal") {
        const category = response.stop_details?.category ?? "n/d";
        throw new Error(`Il modello ha rifiutato la richiesta (categoria: ${category}).`);
      }

      const draft = response.parsed_output as ArticleDraft | null;
      if (!draft) {
        throw new Error(
          "Il modello non ha restituito un articolo strutturato valido (parsed_output nullo).",
        );
      }

      return {
        draft,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },
  };
}
