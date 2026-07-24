import { getSite } from "./sites.js";
import { getSearchProvider } from "./search/index.js";
import type { SearchResult } from "./search/types.js";
import type { TaskProviders } from "./providers/index.js";
import { getEmbedder } from "./embeddings/index.js";
import { buildSignature } from "./signature.js";
import { triageSystem } from "./prompts/triage.js";
import { classifyCandidate } from "./dedup.js";
import { loadState, normalizeUrl } from "./state.js";
import { logUsage } from "./lib/usage.js";
import { generate } from "./generate.js";

export interface DiscoverOptions {
  site: string;
  searchProvider: string;
  maxQueries: number;
  maxArticles: number;
  perQuery: number;
  freshness: string;
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
 * Search-driven discovery. Both editorial judgments — is this on-topic, and which
 * items are the same event — are done by the LLM in one batched triage call
 * (embeddings conflate surface features and get both wrong). Embeddings are used
 * only for the cheap dedup fast path against the covered index. Then one
 * multi-source article is generated per genuinely new event.
 */
export async function discover(
  opts: DiscoverOptions,
  providers: TaskProviders,
): Promise<void> {
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

  // LLM triage: relevance + event grouping in one call.
  if (!providers.triage.triageCandidates) {
    throw new Error(
      `Il provider "${providers.triage.name}" non sa fare la triage: usane uno che la implementa.`,
    );
  }
  const triage = await providers.triage.triageCandidates(
    triageSystem(site.editorialScope),
    candidates.map((c) => ({ title: c.title, snippet: c.snippet })),
  );
  logUsage(`${providers.triage.name} · triage`, triage.usage);

  const kept = candidates.map((_, i) => i).filter((i) => triage.verdicts[i].relevant);
  const dropped = candidates.map((_, i) => i).filter((i) => !triage.verdicts[i].relevant);

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

  // Group kept candidates by the LLM-assigned event id.
  const byEvent = new Map<number, number[]>();
  for (const i of kept) {
    const e = triage.verdicts[i].event;
    const arr = byEvent.get(e);
    if (arr) arr.push(i);
    else byEvent.set(e, [i]);
  }
  const clusters = [...byEvent.values()].sort((a, b) => b.length - a.length);

  const grouped = clusters.filter((c) => c.length > 1).length;
  console.log(
    `\n📰  ${kept.length} in tema → ${clusters.length} eventi distinti (${grouped} con più fonti)\n`,
  );

  // Embeddings only for the dedup fast path (rep signature per cluster).
  const embedder = getEmbedder();
  const repSignatures = clusters.map((c) =>
    buildSignature(candidates[c[0]].title, candidates[c[0]].snippet),
  );
  const repEmbeddings = await embedder.embed(repSignatures.map((s) => s.text));

  let produced = 0;
  for (let ci = 0; ci < clusters.length; ci++) {
    if (!opts.dryRun && produced >= opts.maxArticles) break;

    const cluster = clusters[ci];
    const rep = cluster[0];
    const label = candidates[rep].title;
    const urls = cluster
      .map((i) => candidates[i].url)
      .slice(0, MAX_SOURCES_PER_ARTICLE);

    const state = await loadState(site.slug);
    const verdict = await classifyCandidate(
      { signature: repSignatures[ci], embedding: repEmbeddings[ci] },
      state,
      providers.judge,
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

    await generate(
      { site: opts.site, topic: label, urls, dryRun: false, force: false },
      providers,
    );
  }

  console.log(
    `\nRiepilogo: ${usedQueries} query · ${candidates.length} candidati · ${kept.length} in tema · ${clusters.length} eventi · ` +
      (opts.dryRun
        ? `${produced} nuovi (dry-run, nulla generato)`
        : `${produced} articoli generati (max ${opts.maxArticles})`),
  );
}
