import * as cheerio from "cheerio";
import type { SourceDoc } from "../providers/types.js";

/** Cap per-source text so we pass only useful material to the model (token economy). */
const MAX_CHARS = 6000;

/**
 * Fetch a URL and reduce it to clean article text with a lightweight heuristic
 * (prefer <article>/<main>, strip chrome). Good enough for v1; can be upgraded to
 * a full readability extractor later. This runs locally and is provider-neutral.
 */
export async function fetchSource(url: string): Promise<SourceDoc> {
  const res = await fetch(url, {
    headers: { "user-agent": "NewsForgeBot/0.1 (+https://newsforge.local)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, aside, form, noscript").remove();

  const title = (
    $("meta[property='og:title']").attr("content") ||
    $("title").first().text() ||
    url
  ).trim();

  const article = $("article").first();
  const main = $("main").first();
  const container = article.length ? article : main.length ? main : $("body");

  const text = container.text().replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);

  return { url, title, text };
}

/** Fetch several sources, skipping (with a warning) any that fail. */
export async function fetchSources(urls: string[]): Promise<SourceDoc[]> {
  const docs: SourceDoc[] = [];
  for (const url of urls) {
    try {
      const doc = await fetchSource(url);
      docs.push(doc);
      console.log(`  ↳ fonte ok: ${url} (${doc.text.length} caratteri)`);
    } catch (err) {
      console.warn(`  ⚠️  fonte saltata: ${url} — ${(err as Error).message}`);
    }
  }
  return docs;
}
