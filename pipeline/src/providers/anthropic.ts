import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import type { ArticleDraft } from "../article.js";
import type {
  EventSummary,
  GenerationRequest,
  GenerationResult,
  JudgeResult,
  LLMProvider,
  TriageItem,
  TriageResult,
  TranslationRequest,
  TranslationResult,
} from "./types.js";

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

    async judgeSameEvent(
      system: string,
      a: EventSummary,
      b: EventSummary,
    ): Promise<JudgeResult> {
      const schema = z.object({
        sameEvent: z
          .boolean()
          .describe("true if A and B are the same specific event/announcement"),
        reason: z.string().describe("short rationale"),
      });
      const response = await client.messages.parse({
        model,
        max_tokens: 500,
        system,
        output_config: { format: zodOutputFormat(schema), effort: "low" },
        messages: [
          {
            role: "user",
            content: `NEWS A\nTitle: ${a.title}\nSummary: ${a.summary}\n\nNEWS B\nTitle: ${b.title}\nSummary: ${b.summary}`,
          },
        ],
      });
      const out = response.parsed_output as {
        sameEvent: boolean;
        reason: string;
      } | null;
      if (!out) throw new Error("Giudice same-event: output non valido.");
      return {
        sameEvent: out.sameEvent,
        reason: out.reason,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },

    async translate(req: TranslationRequest): Promise<TranslationResult> {
      const schema = z.object({
        title: z.string().describe("Translated title"),
        description: z.string().describe("Translated one-sentence description"),
        body: z.string().describe("Translated Markdown body, same structure"),
      });
      const response = await client.messages.parse({
        model,
        max_tokens: 8000,
        system: req.system,
        thinking: { type: "adaptive" },
        output_config: { format: zodOutputFormat(schema), effort: "low" },
        messages: [
          {
            role: "user",
            content: `TITLE:\n${req.title}\n\nDESCRIPTION:\n${req.description}\n\nBODY (Markdown):\n${req.body}`,
          },
        ],
      });
      const out = response.parsed_output as {
        title: string;
        description: string;
        body: string;
      } | null;
      if (!out) throw new Error("Traduzione: output non valido.");
      return {
        title: out.title,
        description: out.description,
        body: out.body,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },

    async triageCandidates(
      system: string,
      items: TriageItem[],
    ): Promise<TriageResult> {
      const schema = z.object({
        results: z.array(
          z.object({
            index: z.number().describe("1-based item number"),
            relevant: z.boolean().describe("Is it on-topic for the site?"),
            event: z
              .number()
              .describe(
                "Event group id: items reporting the SAME specific news event share the same number; different events get different numbers",
              ),
          }),
        ),
      });
      const list = items
        .map((it, i) => `${i + 1}. ${it.title} — ${it.snippet.slice(0, 200)}`)
        .join("\n");
      const response = await client.messages.parse({
        model,
        max_tokens: 6000,
        system,
        thinking: { type: "adaptive" },
        output_config: { format: zodOutputFormat(schema), effort: "medium" },
        messages: [{ role: "user", content: list }],
      });
      const out = response.parsed_output as {
        results: { index: number; relevant: boolean; event: number }[];
      } | null;
      if (!out) throw new Error("Triage candidati: output non valido.");

      // Default missing verdicts to relevant + own singleton event.
      const verdicts = items.map((_, i) => ({ relevant: true, event: -(i + 1) }));
      for (const r of out.results) {
        if (r.index >= 1 && r.index <= items.length) {
          verdicts[r.index - 1] = { relevant: r.relevant, event: r.event };
        }
      }
      return {
        verdicts,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },
  };
}
