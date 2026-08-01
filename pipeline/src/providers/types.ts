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

/** A news item reduced to title + short summary, for same-event judging. */
export interface EventSummary {
  title: string;
  summary: string;
}

export interface JudgeResult {
  sameEvent: boolean;
  reason: string;
  usage: Usage;
}

/**
 * Translation of the canonical article's prose. Only title/description/body are
 * sent: category keys, source URLs and frontmatter stay out of the model's reach.
 */
export interface TranslationRequest {
  /** System prompt built by the pipeline (keeps providers prompt-free). */
  system: string;
  title: string;
  description: string;
  body: string;
}

export interface TranslationResult {
  title: string;
  description: string;
  body: string;
  usage: Usage;
}

/** A candidate news item to triage (relevance + event grouping). */
export interface TriageItem {
  title: string;
  snippet: string;
}

export interface TriageVerdict {
  /** Is the item on-topic for the site? */
  relevant: boolean;
  /** Event id: items reporting the SAME news event share the same number. */
  event: number;
  /** Newsworthiness 1 (minor/niche) – 5 (major, widely relevant). Ranks what to generate first. */
  importance: number;
}

export interface TriageResult {
  /** One verdict per input item, in order. */
  verdicts: TriageVerdict[];
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
  /**
   * Optional: decide whether two news items describe the same specific event.
   * Used only for the dedup gray zone. If a provider doesn't implement it, the
   * gray zone is treated conservatively (as a duplicate).
   */
  judgeSameEvent?(
    system: string,
    a: EventSummary,
    b: EventSummary,
  ): Promise<JudgeResult>;
  /**
   * Optional: translate the canonical article's prose into another language.
   * Providers without it simply produce no translations (canonical only).
   */
  translate?(req: TranslationRequest): Promise<TranslationResult>;
  /**
   * Optional: in one batched call, judge which candidates are on-topic AND group
   * them by news event. Both are judgments (not surface similarity), which the LLM
   * does far better than embeddings — see the discovery notes in decisioni.md.
   */
  triageCandidates?(system: string, items: TriageItem[]): Promise<TriageResult>;
}
