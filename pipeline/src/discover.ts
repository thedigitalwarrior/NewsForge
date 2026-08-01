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
  /**
   * Emit the candidate events as a machine-readable JSON block (prefixed with a
   * marker) and generate NOTHING. Used by the console's two-stage flow: find
   * candidates → the human picks → generate the chosen ones separately.
   */
  json?: boolean;
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
 * (embeddings conflate surface features and get both wrong); the LLM also rates
 * each event's importance so the most newsworthy come first. Embeddings are used
 * only for the cheap dedup fast path against the covered index. Then one
 * multi-source article is generated per genuinely new event (or, in `json` mode,
 * the candidate list is emitted for the human to pick from).
 */
export async function discover(
  opts: DiscoverOptions,
  providers: TaskProviders,
): Promise<void> {
  const site = getSite(opts.site);
  const search = getSearchProvider(opts.searchProvider);
  const queries = site.searchQueries.slice(0, opts.maxQueries);
  // In JSON mode stdout must carry only the candidate payload, so human logs go dark.
  const log = opts.json
    ? () => {}
    : (...a: unknown[]) => console.log(...a);
  const emitCandidates = (candidates: unknown[]): void => {
    process.stdout.write(`\n__CANDIDATES__${JSON.stringify({ candidates })}\n`);
  };

  log(
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
      country: site.searchCountry,
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
    log(`  ↳ "${q}": ${results.length} risultati (${added} nuovi)`);
  }

  if (candidates.length === 0) {
    if (opts.json) emitCandidates([]);
    else log("Nessun candidato trovato.");
    return;
  }

  // LLM triage: relevance + event grouping + importance in one call.
  if (!providers.triage.triageCandidates) {
    throw new Error(
      `Il provider "${providers.triage.name}" non sa fare la triage: usane uno che la implementa.`,
    );
  }
  const triage = await providers.triage.triageCandidates(
    triageSystem(site.editorialScope),
    candidates.map((c) => ({ title: c.title, snippet: c.snippet })),
  );
  if (!opts.json) logUsage(`${providers.triage.name} · triage`, triage.usage);

  const kept = candidates.map((_, i) => i).filter((i) => triage.verdicts[i].relevant);
  const dropped = candidates.map((_, i) => i).filter((i) => !triage.verdicts[i].relevant);

  log(
    `\n📊  ${candidates.length} candidati → ${kept.length} in tema (scartati ${dropped.length} fuori tema)`,
  );
  if (opts.dryRun && dropped.length) {
    log("\n── Scartati (fuori tema) ──");
    for (const i of dropped) log(`   ✗ ${candidates[i].title}`);
  }

  if (kept.length === 0) {
    if (opts.json) emitCandidates([]);
    else log("\nNessun candidato in tema. Rivedi le query o l'editorialScope.");
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
  // Importance of an event = the highest importance among its sources.
  const clusterImportance = (c: number[]): number =>
    Math.max(...c.map((i) => triage.verdicts[i].importance ?? 3));
  // Most newsworthy first, then best-corroborated (more sources) as tiebreak.
  const clusters = [...byEvent.values()].sort((a, b) => {
    const di = clusterImportance(b) - clusterImportance(a);
    return di !== 0 ? di : b.length - a.length;
  });

  const grouped = clusters.filter((c) => c.length > 1).length;
  log(
    `\n📰  ${kept.length} in tema → ${clusters.length} eventi distinti (${grouped} con più fonti)\n`,
  );

  // Embeddings only for the dedup fast path (rep signature per cluster).
  const embedder = getEmbedder();
  const repSignatures = clusters.map((c) =>
    buildSignature(candidates[c[0]].title, candidates[c[0]].snippet),
  );
  const repEmbeddings = await embedder.embed(repSignatures.map((s) => s.text));

  // JSON candidate mode: classify dedup for each event and emit the list. No
  // generation — the human picks which to generate in a later step.
  if (opts.json) {
    const state = await loadState(site.slug);
    const out = [];
    for (let ci = 0; ci < clusters.length; ci++) {
      const cluster = clusters[ci];
      const verdict = await classifyCandidate(
        { signature: repSignatures[ci], embedding: repEmbeddings[ci] },
        state,
        providers.judge,
        undefined,
        { useJudge: true },
      );
      out.push({
        event: triage.verdicts[cluster[0]].event,
        label: candidates[cluster[0]].title,
        sourceCount: cluster.length,
        importance: clusterImportance(cluster),
        dedup: verdict.kind === "duplicate" ? "duplicate" : "new",
        dedupScore: Number(verdict.score.toFixed(3)),
        sources: cluster
          .map((i) => candidates[i].url)
          .slice(0, MAX_SOURCES_PER_ARTICLE),
        hosts: [...new Set(cluster.map((i) => hostOf(candidates[i])))].slice(
          0,
          MAX_SOURCES_PER_ARTICLE,
        ),
      });
    }
    emitCandidates(out);
    return;
  }

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
    log(
      `${tag}  [imp ${clusterImportance(cluster)} · ${cluster.length} fonti]  ${label}`,
    );
    if (cluster.length > 1) {
      for (const i of cluster) {
        log(`        · ${hostOf(candidates[i])} — ${candidates[i].title}`);
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

  log(
    `\nRiepilogo: ${usedQueries} query · ${candidates.length} candidati · ${kept.length} in tema · ${clusters.length} eventi · ` +
      (opts.dryRun
        ? `${produced} nuovi (dry-run, nulla generato)`
        : `${produced} articoli generati (max ${opts.maxArticles})`),
  );
}
