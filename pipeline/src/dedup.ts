import { cosine } from "./embeddings/similarity.js";
import type { EventSignature } from "./signature.js";
import type { CoveredEntry, SiteState } from "./state.js";
import type { LLMProvider, Usage } from "./providers/types.js";

export interface DedupThresholds {
  /** At/above this cosine → duplicate. */
  high: number;
  /** Below this cosine → new. Between the two is the gray zone (LLM judge). */
  low: number;
}

export const DEFAULT_THRESHOLDS: DedupThresholds = { high: 0.86, low: 0.72 };

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
  provider: LLMProvider,
  thresholds: DedupThresholds = DEFAULT_THRESHOLDS,
): Promise<Verdict> {
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

  // Gray zone → ask the judge if the provider offers one.
  if (provider.judgeSameEvent) {
    const res = await provider.judgeSameEvent(
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
