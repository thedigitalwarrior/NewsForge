import { createAnthropicProvider } from "./anthropic.js";
import { createMockProvider } from "./mock.js";
import { createOpenAICompatibleProvider } from "./openai.js";
import type { LLMProvider } from "./types.js";

export const availableProviders = ["anthropic", "openai", "local", "mock"] as const;

/** AI roles the pipeline can assign to different providers. */
export const aiRoles = ["triage", "judge", "generate", "translate"] as const;
export type AiRole = (typeof aiRoles)[number];
export type TaskProviders = Record<AiRole, LLMProvider>;

/**
 * Build one provider by name. `local` is the OpenAI-compatible adapter pointed at
 * a local server (Ollama/LM Studio), configured via env.
 */
export function getProvider(name: string): LLMProvider {
  switch (name) {
    case "anthropic":
      return createAnthropicProvider();
    case "openai":
      return createOpenAICompatibleProvider({
        name: `openai:${process.env.PIPELINE_OPENAI_MODEL ?? "gpt-5"}`,
        apiKey: process.env.OPENAI_API_KEY ?? "",
        model: process.env.PIPELINE_OPENAI_MODEL ?? "gpt-5",
      });
    case "local":
      return createOpenAICompatibleProvider({
        name: `local:${process.env.PIPELINE_LOCAL_MODEL ?? "?"}`,
        baseURL: process.env.PIPELINE_LOCAL_URL ?? "http://localhost:11434/v1",
        apiKey: process.env.PIPELINE_LOCAL_API_KEY ?? "local",
        model: process.env.PIPELINE_LOCAL_MODEL ?? "qwen2.5:72b",
      });
    case "mock":
      return createMockProvider();
    default:
      throw new Error(
        `Provider sconosciuto: "${name}". Disponibili: ${availableProviders.join(", ")}.`,
      );
  }
}

/**
 * Resolve which provider handles each AI role. Precedence per role:
 *   CLI --provider (overrides all)  >  PIPELINE_PROVIDER_<ROLE>  >  PIPELINE_PROVIDER  >  "anthropic".
 * So you can run, e.g., triage/judge locally and generate/translate on Claude,
 * just by editing pipeline/.env — no code change.
 */
export function resolveTaskProviders(overrideAll?: string): TaskProviders {
  const cache = new Map<string, LLMProvider>();
  const instance = (name: string): LLMProvider => {
    let p = cache.get(name);
    if (!p) {
      p = getProvider(name);
      cache.set(name, p);
    }
    return p;
  };
  const pick = (role: AiRole): string =>
    overrideAll ??
    process.env[`PIPELINE_PROVIDER_${role.toUpperCase()}`] ??
    process.env.PIPELINE_PROVIDER ??
    "anthropic";

  const providers = Object.fromEntries(
    aiRoles.map((role) => [role, instance(pick(role))]),
  ) as TaskProviders;
  return providers;
}
