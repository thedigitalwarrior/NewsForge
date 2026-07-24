import OpenAI from "openai";
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
  Usage,
} from "./types.js";

export interface OpenAICompatibleOptions {
  name: string;
  /** Undefined = OpenAI's own endpoint; set to a local URL for Ollama/LM Studio. */
  baseURL?: string;
  apiKey: string;
  model: string;
}

/**
 * OpenAI-compatible adapter. Covers OpenAI itself AND local models served with an
 * OpenAI-compatible API (Ollama, LM Studio, llama.cpp). Structured output is done
 * with json_object + the JSON schema injected into the prompt, then validated with
 * Zod — the most portable approach across hosted and local servers.
 */
export function createOpenAICompatibleProvider(
  o: OpenAICompatibleOptions,
): LLMProvider {
  const client = new OpenAI({ apiKey: o.apiKey, baseURL: o.baseURL });

  async function structured<T>(
    system: string,
    user: string,
    schema: z.ZodType,
    maxTokens: number,
  ): Promise<{ data: T; usage: Usage }> {
    const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
    const sys = `${system}\n\nRespond with ONLY a JSON object conforming to this JSON Schema. No prose, no markdown fences.\nJSON Schema:\n${jsonSchema}`;
    const completion = await client.chat.completions.create({
      model: o.model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });
    let content = completion.choices[0]?.message?.content ?? "";
    content = content
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    if (!content) throw new Error(`${o.name}: risposta vuota.`);
    const data = schema.parse(JSON.parse(content)) as T;
    return {
      data,
      usage: {
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      },
    };
  }

  return {
    name: o.name,

    async generate(req: GenerationRequest): Promise<GenerationResult> {
      const { data, usage } = await structured<ArticleDraft>(
        req.system,
        req.instructions,
        req.schema,
        8000,
      );
      return { draft: data, usage };
    },

    async judgeSameEvent(
      system: string,
      a: EventSummary,
      b: EventSummary,
    ): Promise<JudgeResult> {
      const schema = z.object({ sameEvent: z.boolean(), reason: z.string() });
      const user = `NEWS A\nTitle: ${a.title}\nSummary: ${a.summary}\n\nNEWS B\nTitle: ${b.title}\nSummary: ${b.summary}`;
      const { data, usage } = await structured<{
        sameEvent: boolean;
        reason: string;
      }>(system, user, schema, 500);
      return { sameEvent: data.sameEvent, reason: data.reason, usage };
    },

    async translate(req: TranslationRequest): Promise<TranslationResult> {
      const schema = z.object({
        title: z.string(),
        description: z.string(),
        body: z.string(),
      });
      const user = `TITLE:\n${req.title}\n\nDESCRIPTION:\n${req.description}\n\nBODY (Markdown):\n${req.body}`;
      const { data, usage } = await structured<{
        title: string;
        description: string;
        body: string;
      }>(req.system, user, schema, 8000);
      return { ...data, usage };
    },

    async triageCandidates(
      system: string,
      items: TriageItem[],
    ): Promise<TriageResult> {
      const schema = z.object({
        results: z.array(
          z.object({
            index: z.number(),
            relevant: z.boolean(),
            event: z.number(),
          }),
        ),
      });
      const list = items
        .map((it, i) => `${i + 1}. ${it.title} — ${it.snippet.slice(0, 200)}`)
        .join("\n");
      const { data, usage } = await structured<{
        results: { index: number; relevant: boolean; event: number }[];
      }>(system, list, schema, 6000);
      const verdicts = items.map((_, i) => ({ relevant: true, event: -(i + 1) }));
      for (const r of data.results) {
        if (r.index >= 1 && r.index <= items.length) {
          verdicts[r.index - 1] = { relevant: r.relevant, event: r.event };
        }
      }
      return { verdicts, usage };
    },
  };
}
