import type { ArticleDraft } from "../article.js";

/**
 * Serialize a validated draft to a Markdown file with YAML frontmatter matching
 * the shared schema. Always writes `draft: true` — publishing is a separate human
 * step. Uses JSON.stringify for string scalars (valid double-quoted YAML).
 */
export function toMarkdown(draft: ArticleDraft, pubDate: Date): string {
  const date = pubDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const lines: string[] = ["---"];
  lines.push(`title: ${JSON.stringify(draft.title)}`);
  lines.push(`description: ${JSON.stringify(draft.description)}`);
  lines.push(`pubDate: ${date}`);
  lines.push(`category: ${JSON.stringify(draft.category)}`);
  lines.push("sources:");
  for (const url of draft.sources) lines.push(`  - ${JSON.stringify(url)}`);
  lines.push("draft: true");
  lines.push("---");
  lines.push("");
  lines.push(draft.body.trim());
  lines.push("");
  return lines.join("\n");
}
