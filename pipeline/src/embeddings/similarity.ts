/** Cosine similarity between two vectors (robust even if not pre-normalized). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Greedy single-pass clustering: each item joins the cluster whose representative
 * is the MOST similar (above `threshold`), else starts a new one. Good enough for
 * the small batches a single run produces (candidates from a few searches).
 * Returns clusters as lists of input indices.
 */
export function clusterIndices(
  embeddings: number[][],
  threshold: number,
): number[][] {
  const clusters: number[][] = [];
  const reps: number[][] = [];
  for (let i = 0; i < embeddings.length; i++) {
    let bestCluster = -1;
    let bestScore = threshold;
    for (let c = 0; c < reps.length; c++) {
      const score = cosine(embeddings[i], reps[c]);
      if (score >= bestScore) {
        bestScore = score;
        bestCluster = c;
      }
    }
    if (bestCluster >= 0) {
      clusters[bestCluster].push(i);
    } else {
      reps.push(embeddings[i]);
      clusters.push([i]);
    }
  }
  return clusters;
}
