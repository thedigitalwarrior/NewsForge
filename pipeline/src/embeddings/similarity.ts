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
 * Nearest-neighbour single-link clustering: each item joins the cluster of the
 * MOST similar item seen so far (above `threshold`), else starts a new one. This
 * groups differently-worded titles of the same event (each joins via whichever
 * sibling it resembles), unlike comparing only to a cluster representative.
 * O(n²), fine for the small batches a run produces. Returns lists of indices.
 */
export function clusterIndices(
  embeddings: number[][],
  threshold: number,
): number[][] {
  const n = embeddings.length;
  const clusterOf = new Array<number>(n).fill(-1);
  let next = 0;
  for (let i = 0; i < n; i++) {
    let bestJ = -1;
    let bestScore = threshold;
    for (let j = 0; j < i; j++) {
      const score = cosine(embeddings[i], embeddings[j]);
      if (score >= bestScore) {
        bestScore = score;
        bestJ = j;
      }
    }
    clusterOf[i] = bestJ >= 0 ? clusterOf[bestJ] : next++;
  }
  const byCluster = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const c = clusterOf[i];
    const arr = byCluster.get(c);
    if (arr) arr.push(i);
    else byCluster.set(c, [i]);
  }
  return [...byCluster.values()];
}
