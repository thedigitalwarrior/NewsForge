import { createLocalEmbedder } from "./local.js";
import type { Embedder } from "./types.js";

/**
 * Resolve the embedder. Local-only for now; the interface leaves room for a
 * remote backend later without touching the dedup logic.
 */
export function getEmbedder(): Embedder {
  return createLocalEmbedder();
}
