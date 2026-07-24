import { getSite } from "./sites.js";
import { getSearchProvider } from "./search/index.js";
import type { SearchResult } from "./search/types.js";
import { getProvider } from "./providers/index.js";
import { getEmbedder } from "./embeddings/index.js";
import { buildSignature } from "./signature.js";
import { clusterIndices, cosine } from "./embeddings/similarity.js";
import { classifyCandidate } from "./dedup.js";
import { loadState, normalizeUrl } from "./state.js";
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
  /** Min cosine to the site topic anchor to keep a candidate (drops off-topic). */
  minRelevance: number;
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
 * noise (relevance gate), cluster the rest per event, skip what's already
 * covered, and generate one multi-source article per genuinely new event.
 */
export async function discover(opts: DiscoverOptions): Promise<void> {
  const site = getSite(opts.site);
  const search = getSearchProvider(opts.searchProvider);
  const queries = site.searchQueries.slice(0, opts.maxQueries);

  console.log(
    `🔎  Scoperta per ${site.name}: ${queries.length} query su "${search.name}" ` +
      `(freshness=${opts.freshness}, rilevanza≥${opts.minRelevance}, clustering@${opts.clusterThreshold})`,
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

  const embedder = getEmbedder();
  const signatures = candidates.map((c) => buildSignature(c.title, c.snippet));
  // Embed the anchor together with the candidates in one batch.
  const allEmb = await embedder.embed([
    site.topicAnchor,
    ...signatures.map((s) => s.text),
  ]);
  const anchorEmb = allEmb[0];
  const embeddings = allEmb.slice(1);
  const relevance = embeddings.map((e) => cosine(e, anchorEmb));

  // Relevance gate: keep on-topic candidates.
  const kept = candidates
    .map((_, i) => i)
    .filter((i) => relevance[i] >= opts.minRelevance);
  const dropped = candidates
    .map((_, i) => i)
    .filter((i) => relevance[i] < opts.minRelevance)
    .sort((a, b) => relevance[b] - relevance[a]);

  console.log(
    `\n📊  ${candidates.length} candidati → ${kept.length} in tema (scartati ${dropped.length} sotto rilevanza ${opts.minRelevance})`,
  );

  if (opts.dryRun && dropped.length) {
    console.log("\n── Scartati per rilevanza (titolo · punteggio) ──");
    for (const i of dropped) {
      console.log(`   ${relevance[i].toFixed(2)}  ${candidates[i].title}`);
    }
  }

  if (kept.length === 0) {
    console.log("\nNessun candidato in tema. Abbassa --min-relevance o rivedi le query.");
    return;
  }

  // Cluster the kept candidates by event. clusterIndices works on the kept
  // subset; positions map back to candidate indices via `kept`.
  const keptEmb = kept.map((i) => embeddings[i]);
  const clusters = clusterIndices(keptEmb, opts.clusterThreshold)
    .map((positions) => positions.map((p) => kept[p]))
    .sort((a, b) => b.length - a.length); // biggest events first

  const grouped = clusters.filter((c) => c.length > 1).length;
  console.log(
    `\n📰  ${kept.length} in tema → ${clusters.length} eventi distinti (${grouped} con più fonti)\n`,
  );

  const llm = getProvider(opts.provider);
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
      { signature: signatures[rep], embedding: embeddings[rep] },
      state,
      llm,
      undefined,
      { useJudge: !opts.dryRun },
    );

    const covered = verdict.kind === "duplicate";
    const tag = covered ? `⏭  già coperto (${verdict.score.toFixed(2)})` : "🆕";
    console.log(
      `${tag}  [rel ${relevance[rep].toFixed(2)}] [${cluster.length} fonti]  ${label}`,
    );
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
