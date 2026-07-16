import { createAnthropicProvider } from "./anthropic.js";
import { createMockProvider } from "./mock.js";
import type { LLMProvider } from "./types.js";

export const availableProviders = ["anthropic", "mock"] as const;
export type ProviderName = (typeof availableProviders)[number];

/**
 * Resolve a provider by name. To add OpenAI or a local (OpenAI-compatible) LLM,
 * implement the LLMProvider interface in a new file and register it here — the
 * rest of the pipeline is provider-agnostic.
 */
export function getProvider(name: string): LLMProvider {
  switch (name) {
    case "anthropic":
      return createAnthropicProvider();
    case "mock":
      return createMockProvider();
    default:
      throw new Error(
        `Provider sconosciuto: "${name}". Disponibili: ${availableProviders.join(", ")}.`,
      );
  }
}
