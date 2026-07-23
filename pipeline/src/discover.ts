import { getSite } from "./sites.js";
import { getSearchProvider } from "./search/index.js";
import type { SearchResult } from "./search/types.js";
import { getProvider } from "./providers/index.js";
import { getEmbedder } from "./embeddings/index.js";
import { buildSignature } from "./signature.js";
import { clusterIndices } from "./embeddings/similarity.js";
import { classifyCandidate, DEFAULT_THRESHOLDS } from "./dedup.js";
import { loadState, normalizeUrl } from "./state.js";
import { generate } from "./generate.js";

export interface DiscoverOptions {
  site: string;
  /** LLM provider used for generation and the same-event judge. */
  provider: string;
  /** Search engine backend. */
  searchProvider: string;
  maxQueries: number;
  maxArticles: number;
  perQuery: number;
  freshness: string;
  dryRun: boolean;
}

/** Max source URLs passed to a single article (keeps fetch + tokens sane). */
const MAX_SOURCES_PER_ARTICLE = 3;

/**
 * Search-driven discovery: run the site's editorial queries, gather candidates
 * from many outlets, cluster them per event, drop what's already covered, and
 * generate one multi-source article per genuinely new event.
 */
export async function discover(opts: DiscoverOptions): Promise<void> {
  const site = getSite(opts.site);
  const search = getSearchProvider(opts.searchProvider);
  const queries = site.searchQueries.slice(0, opts.maxQueries);

  console.log(
    `🔎  Scoperta per ${site.name}: ${queries.length} query su "${search.name}" (freshness=${opts.freshness})`,
  );

  const seenUrls = new Set<string>();
  const candidates: SearchResult[] = [];
  let usedQueries = 0;

  for (const q of queries) {
    const results = await search.search({
      query: q,
      count: opts.perQuery,
      freshness: opts.freshness,
      lang: site.canonicalLocale,
    });
    usedQueries++;
    let added = 0;
    for (const r of results) {
      const key = normalizeUrl(r.url);
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);
      candidates.push(r);
      added++;
    }
    console.log(`  ↳ "${q}": ${results.length} risultati (${added} nuovi)`);
  }

  if (candidates.length === 0) {
    console.log("Nessun candidato trovato.");
    return;
  }

  // Cluster candidates by event (multilingual embeddings: sources in any
  // language about the same event land in the same cluster).
  const embedder = getEmbedder();
  const signatures = candidates.map((c) => buildSignature(c.title, c.snippet));
  const embeddings = await embedder.embed(signatures.map((s) => s.text));
  const clusters = clusterIndices(embeddings, DEFAULT_THRESHOLDS.high);

  console.log(
    `\n📊  ${candidates.length} candidati → ${clusters.length} eventi distinti\n`,
  );

  const llm = getProvider(opts.provider);
  let produced = 0;

  for (const cluster of clusters) {
    if (produced >= opts.maxArticles) {
      console.log(`\n(limite di ${opts.maxArticles} articoli per run raggiunto)`);
      break;
    }

    const rep = cluster[0];
    const label = candidates[rep].title;
    const urls = cluster
      .map((i) => candidates[i].url)
      .slice(0, MAX_SOURCES_PER_ARTICLE);

    // Reload each time: a previous generation in this same run may have
    // extended the covered index.
    const state = await loadState(site.slug);
    const verdict = await classifyCandidate(
      { signature: signatures[rep], embedding: embeddings[rep] },
      state,
      llm,
    );

    if (verdict.kind === "duplicate") {
      console.log(
        `⏭  già coperto (score ${verdict.score.toFixed(3)}, via ${verdict.via}): ${label}`,
      );
      continue;
    }

    console.log(`\n🆕  ${label}`);
    console.log(`    fonti nel cluster (${urls.length}): ${urls.join(" | ")}`);
    produced++;

    if (opts.dryRun) continue;

    await generate({
      site: opts.site,
      provider: opts.provider,
      topic: label,
      urls,
      dryRun: false,
      force: false,
    });
  }

  console.log(
    `\nRiepilogo: ${usedQueries} query consumate · ${candidates.length} candidati · ${clusters.length} eventi · ${produced} ${opts.dryRun ? "selezionati (dry-run, nulla generato)" : "articoli generati"}.`,
  );
}
