/** One candidate news item returned by a search engine. */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Publisher domain, when the engine reports it. */
  source?: string;
  /** Free-form freshness/date string, when available. */
  publishedAt?: string;
}

export interface SearchQuery {
  query: string;
  /** Max results to request. */
  count?: number;
  /** Freshness window: "pd" (past day), "pw" (week), "pm" (month). */
  freshness?: string;
  /** Search language, e.g. "en". */
  lang?: string;
  /** Country bias, e.g. "us". */
  country?: string;
}

/**
 * Provider-neutral search, like LLMProvider and Embedder: discovery of what to
 * write about is a separate concern from generation, and the backend is swappable.
 */
export interface SearchProvider {
  readonly name: string;
  search(q: SearchQuery): Promise<SearchResult[]>;
}
