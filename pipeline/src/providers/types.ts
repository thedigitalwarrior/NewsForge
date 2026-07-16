import type { z } from "zod/v4";
import type { ArticleDraft } from "../article.js";

/** A source document already fetched and reduced to clean text by the pipeline. */
export interface SourceDoc {
  url: string;
  title: string;
  text: string;
}

export interface GenerationRequest {
  /** Editorial system prompt. */
  system: string;
  /** The task + source material, as a single user message. */
  instructions: string;
  /** Fetched sources (may be empty). */
  sources: SourceDoc[];
  /** Allowed categories for this site (so tool-less providers can pick a valid one). */
  categories: readonly string[];
  /** Zod (v4) schema of the expected article output. */
  schema: z.ZodType;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerationResult {
  draft: ArticleDraft;
  usage: Usage;
}

/**
 * Provider-neutral synthesis step. The pipeline does the research (fetch +
 * extraction) itself and passes clean material here, so any backend — Claude,
 * OpenAI, or a local LLM — can implement this without needing a web-search tool.
 */
export interface LLMProvider {
  readonly name: string;
  generate(req: GenerationRequest): Promise<GenerationResult>;
}
