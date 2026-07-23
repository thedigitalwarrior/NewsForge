import type { SearchProvider, SearchQuery, SearchResult } from "./types.js";

const NEWS_ENDPOINT = "https://api.search.brave.com/res/v1/news/search";

/** Free tier allows ~1 request/second — stay under it. */
const MIN_INTERVAL_MS = 1100;
let lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

/**
 * Brave Search API (news endpoint). Independent index, official API, generous
 * free tier. Returns titles/URLs/snippets; the pipeline fetches and extracts the
 * full text itself, so we never pay for content we can retrieve locally.
 */
export function createBraveSearchProvider(apiKey?: string): SearchProvider {
  const key = apiKey ?? process.env.BRAVE_API_KEY;

  return {
    name: "brave",
    async search(q: SearchQuery): Promise<SearchResult[]> {
      if (!key) {
        throw new Error(
          "BRAVE_API_KEY mancante: mettila in pipeline/.env (o nell'ambiente).",
        );
      }

      const params = new URLSearchParams({
        q: q.query,
        count: String(q.count ?? 20),
      });
      if (q.freshness) params.set("freshness", q.freshness);
      if (q.lang) params.set("search_lang", q.lang);
      if (q.country) params.set("country", q.country);

      await throttle();
      const res = await fetch(`${NEWS_ENDPOINT}?${params}`, {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": key,
        },
      });

      const body = await res.text();
      if (!res.ok) {
        throw new Error(
          `Brave search HTTP ${res.status}: ${body.slice(0, 300)}`,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error(`Brave search: risposta non JSON: ${body.slice(0, 200)}`);
      }

      const results = (parsed as { results?: unknown[] }).results;
      if (!Array.isArray(results)) {
        throw new Error(
          `Brave search: campo "results" assente. Risposta: ${body.slice(0, 300)}`,
        );
      }

      return results.map((r) => {
        const item = r as {
          title?: string;
          url?: string;
          description?: string;
          age?: string;
          page_age?: string;
          meta_url?: { hostname?: string };
        };
        return {
          title: (item.title ?? "").trim(),
          url: item.url ?? "",
          snippet: (item.description ?? "").replace(/<[^>]*>/g, "").trim(),
          source: item.meta_url?.hostname,
          publishedAt: item.page_age ?? item.age,
        } satisfies SearchResult;
      }).filter((r) => r.url && r.title);
    },
  };
}
