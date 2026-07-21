/**
 * Provider-neutral embedding interface (mirrors the LLMProvider spirit): today a
 * local model, tomorrow possibly a remote one. Returns one vector per input text.
 */
export interface Embedder {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}
