import { cosine } from "./embeddings/similarity.js";
import { judgeSystem } from "./prompts/judge.js";
import type { EventSignature } from "./signature.js";
import type { CoveredEntry, SiteState } from "./state.js";
import type { LLMProvider, Usage } from "./providers/types.js";

export interface DedupThresholds {
  /** At/above this cosine → duplicate. */
  high: number;
  /** Below this cosine → new. Between the two is the gray zone (LLM judge). */
  low: number;
}

// `low` is deliberately conservative: in tight domains (e.g. "free game X on
// store Y") the same giveaway reworded a day later can score only ~0.65 while
// two genuinely different giveaways sit ~0.54 — the embedding barely separates
// them. So the floor is set low enough that such borderline pairs reach the LLM
// judge (which decides accurately) instead of being auto-accepted as new. The
// cost is a few extra cheap judge calls per run.
export const DEFAULT_THRESHOLDS: DedupThresholds = { high: 0.86, low: 0.6 };

export type Verdict =
  | { kind: "new"; score: number; usage?: Usage }
  | {
      kind: "duplicate";
      score: number;
      match: CoveredEntry;
      via: "embedding" | "judge" | "conservative";
      usage?: Usage;
    };

/**
 * Cascade: embedding similarity against the covered index, with an LLM judge for
 * the gray zone. If no judge is available, the gray zone is treated as a
 * duplicate (conservative: better to skip a maybe-dup than publish a doubled news).
 */
export async function classifyCandidate(
  candidate: { signature: EventSignature; embedding: number[] },
  state: SiteState,
  judgeProvider: LLMProvider,
  thresholds: DedupThresholds = DEFAULT_THRESHOLDS,
  opts: { useJudge?: boolean } = {},
): Promise<Verdict> {
  const useJudge = opts.useJudge ?? true;
  const covered = state.covered.filter(
    (e) => e.embedding && e.embedding.length > 0,
  );
  if (covered.length === 0) return { kind: "new", score: 0 };

  let best: { score: number; entry: CoveredEntry } | null = null;
  for (const entry of covered) {
    const score = cosine(candidate.embedding, entry.embedding!);
    if (!best || score > best.score) best = { score, entry };
  }
  const { score, entry } = best!;

  if (score >= thresholds.high) {
    return { kind: "duplicate", score, match: entry, via: "embedding" };
  }
  if (score < thresholds.low) {
    return { kind: "new", score };
  }

  // Gray zone → ask the judge if the provider offers one (unless disabled).
  if (useJudge && judgeProvider.judgeSameEvent) {
    const res = await judgeProvider.judgeSameEvent(
      judgeSystem(),
      { title: candidate.signature.title, summary: candidate.signature.summary },
      { title: entry.title ?? entry.slug, summary: entry.summary ?? "" },
    );
    return res.sameEvent
      ? { kind: "duplicate", score, match: entry, via: "judge", usage: res.usage }
      : { kind: "new", score, usage: res.usage };
  }

  // No judge available → conservative.
  return { kind: "duplicate", score, match: entry, via: "conservative" };
}
