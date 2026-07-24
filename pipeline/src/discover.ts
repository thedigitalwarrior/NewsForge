import { getSite } from "./sites.js";
import { getSearchProvider } from "./search/index.js";
import type { SearchResult } from "./search/types.js";
import { getProvider } from "./providers/index.js";
import { getEmbedder } from "./embeddings/index.js";
import { buildSignature } from "./signature.js";
import { clusterIndices } from "./embeddings/similarity.js";
import { classifyCandidate } from "./dedup.js";
import { loadState, normalizeUrl } from "./state.js";
import { logUsage } from "./lib/usage.js";
import { generate } from "./generate.js";

export interface DiscoverOptions {
  site: string;
  provider: string;
  searchProvider: string;
  maxQueries: number;
  maxArticles: number;
  perQuery: number;
  freshness: string;
  /** Cosine threshold to group candidates into one event (lower = looser). */
  clusterThreshold: number;
  dryRun: boolean;
}

/** Max source URLs passed to a single article (keeps fetch + tokens sane). */
const MAX_SOURCES_PER_ARTICLE = 3;

function hostOf(r: SearchResult): string {
  if (r.source) return r.source;
  try {
    return new URL(r.url).hostname;
  } catch {
    return r.url;
  }
}

/**
 * Search-driven discovery: run the site's editorial queries, drop off-topic
 * items with the LLM relevance filter (a judgment, not a similarity), cluster the
 * rest per event, skip what's already covered, and generate one multi-source
 * article per genuinely new event.
 */
export async function discover(opts: DiscoverOptions): Promise<void> {
  const site = getSite(opts.site);
  const search = getSearchProvider(opts.searchProvider);
  const llm = getProvider(opts.provider);
  const queries = site.searchQueries.slice(0, opts.maxQueries);

  console.log(
    `🔎  Scoperta per ${site.name}: ${queries.length} query su "${search.name}" ` +
      `(freshness=${opts.freshness}, clustering@${opts.clusterThreshold})`,
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

  // Relevance filter (LLM, one batched call). Judgment, not similarity.
  let keep = candidates.map(() => true);
  if (llm.filterRelevant) {
    const res = await llm.filterRelevant(
      site.editorialScope,
      candidates.map((c) => ({ title: c.title, snippet: c.snippet })),
    );
    keep = res.relevant;
    logUsage(`${llm.name} · filtro rilevanza`, res.usage);
  } else {
    console.warn(`  ⚠️  Il provider "${llm.name}" non filtra la rilevanza: tengo tutto.`);
  }

  const kept = candidates.map((_, i) => i).filter((i) => keep[i]);
  const dropped = candidates.map((_, i) => i).filter((i) => !keep[i]);

  console.log(
    `\n📊  ${candidates.length} candidati → ${kept.length} in tema (scartati ${dropped.length} fuori tema)`,
  );
  if (opts.dryRun && dropped.length) {
    console.log("\n── Scartati (fuori tema) ──");
    for (const i of dropped) console.log(`   ✗ ${candidates[i].title}`);
  }

  if (kept.length === 0) {
    console.log("\nNessun candidato in tema. Rivedi le query o l'editorialScope.");
    return;
  }

  // Cluster the kept candidates by event.
  const embedder = getEmbedder();
  const signatures = candidates.map((c) => buildSignature(c.title, c.snippet));
  const keptEmb = await embedder.embed(kept.map((i) => signatures[i].text));
  const clusters = clusterIndices(keptEmb, opts.clusterThreshold)
    .map((positions) => positions.map((p) => kept[p]))
    .sort((a, b) => b.length - a.length); // biggest events first

  const grouped = clusters.filter((c) => c.length > 1).length;
  console.log(
    `\n📰  ${kept.length} in tema → ${clusters.length} eventi distinti (${grouped} con più fonti)\n`,
  );

  // Map candidate index -> its embedding (needed for the history dedup).
  const embOf = new Map<number, number[]>();
  kept.forEach((candIdx, p) => embOf.set(candIdx, keptEmb[p]));

  let produced = 0;
  for (const cluster of clusters) {
    if (!opts.dryRun && produced >= opts.maxArticles) break;

    const rep = cluster[0];
    const label = candidates[rep].title;
    const urls = cluster
      .map((i) => candidates[i].url)
      .slice(0, MAX_SOURCES_PER_ARTICLE);

    const state = await loadState(site.slug);
    const verdict = await classifyCandidate(
      { signature: signatures[rep], embedding: embOf.get(rep)! },
      state,
      llm,
      undefined,
      { useJudge: !opts.dryRun },
    );

    const covered = verdict.kind === "duplicate";
    const tag = covered ? `⏭  già coperto (${verdict.score.toFixed(2)})` : "🆕";
    console.log(`${tag}  [${cluster.length} fonti]  ${label}`);
    if (cluster.length > 1) {
      for (const i of cluster) {
        console.log(`        · ${hostOf(candidates[i])} — ${candidates[i].title}`);
      }
    }

    if (covered) continue;
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
    `\nRiepilogo: ${usedQueries} query · ${candidates.length} candidati · ${kept.length} in tema · ${clusters.length} eventi · ` +
      (opts.dryRun
        ? `${produced} nuovi (dry-run, nulla generato)`
        : `${produced} articoli generati (max ${opts.maxArticles})`),
  );
}
