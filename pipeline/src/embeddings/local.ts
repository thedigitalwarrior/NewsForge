import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { Embedder } from "./types.js";

/**
 * Local, offline sentence-embedding model (runs on CPU via transformers.js).
 * Multilingual, 384-dim, tuned for sentence similarity — no query/passage
 * prefixes to worry about. Downloaded once (~120 MB), then cached. Zero API cost.
 */
const DEFAULT_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

export function createLocalEmbedder(
  model: string = process.env.PIPELINE_EMBED_MODEL ?? DEFAULT_MODEL,
): Embedder {
  let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
  const getExtractor = (): Promise<FeatureExtractionPipeline> => {
    if (!extractorPromise) {
      extractorPromise = pipeline("feature-extraction", model);
    }
    return extractorPromise;
  };

  return {
    name: `local:${model}`,
    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const extractor = await getExtractor();
      // mean pooling + L2 normalize → unit vectors (cosine == dot product).
      const output = await extractor(texts, { pooling: "mean", normalize: true });
      return output.tolist() as number[][];
    },
  };
}
