import type { Usage } from "../providers/types.js";

/** Log token usage — cost-per-article is a first-class metric for this pipeline. */
export function logUsage(provider: string, usage: Usage): void {
  const total = usage.inputTokens + usage.outputTokens;
  console.log(
    `ℹ️  ${provider} · token input ${usage.inputTokens} · output ${usage.outputTokens} · totale ${total}`,
  );
}
