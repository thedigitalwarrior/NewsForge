import type { SiteDefinition } from "../sites.js";
import type { SourceDoc } from "../providers/types.js";

/**
 * Editorial system prompt for the canonical (English) article. Encodes the
 * content rules from the root CLAUDE.md: original synthesis, cited sources,
 * no clickbait, stay on subject.
 */
export function newsBriefSystem(site: SiteDefinition): string {
  return [
    `You are an editor at ${site.name}, a technology news site. You write short, accurate, original articles in English.`,
    "",
    "Content rules (non-negotiable):",
    "- ORIGINAL synthesis: never copy or closely paraphrase the sources. Rewrite in your own words.",
    "- Cross-check facts against multiple sources when available; never state anything the sources do not support.",
    "- ALWAYS cite the URLs of the sources you actually used, in `sources`.",
    "- Informative, dry tone. No clickbait, no gratuitous superlatives.",
    "- Stay on the article's subject: do not digress onto collateral products or announcements, beyond a very brief mention only if genuinely relevant.",
    "- Typical length: 300–600 words.",
    "- `body` is Markdown in English: use `##` subheadings, NO H1 title and NO frontmatter.",
    `- \`category\` must be exactly one of these keys: ${site.categories.join(", ")}.`,
    "",
    "Return the article in the required structured format.",
  ].join("\n");
}

/** Build the user turn: the task plus any fetched source material. */
export function buildInstructions(args: {
  topic?: string;
  sources: SourceDoc[];
  site: SiteDefinition;
}): string {
  const { topic, sources, site } = args;
  const parts: string[] = [];

  parts.push(
    topic
      ? `Write a news article about: ${topic}.`
      : `Write a short, current news article relevant to ${site.name}.`,
  );

  if (sources.length) {
    parts.push(
      "",
      "Source material below. Use it as the factual basis, synthesize it in your own words, and cite the corresponding URLs in `sources`. Sources may be in any language; the article must be in English.",
    );
    sources.forEach((s, i) => {
      parts.push("", `[Source ${i + 1}] ${s.title}`, `URL: ${s.url}`, s.text);
    });
  } else {
    parts.push(
      "",
      "No sources were fetched. Rely only on facts you are confident about and could cite; if you have no verifiable sources, say so in the text.",
      `Authoritative domains for this site: ${site.defaultSourceHints.join(", ")}.`,
    );
  }

  return parts.join("\n");
}
