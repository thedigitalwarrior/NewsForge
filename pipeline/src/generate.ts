import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ArticleDraft } from "./article.js";
import { buildArticleSchema } from "./article.js";
import { getSite, localeNames } from "./sites.js";
import type { TaskProviders } from "./providers/index.js";
import { fetchSources } from "./research/fetch.js";
import { buildInstructions, newsBriefSystem } from "./prompts/news-brief.js";
import { translateSystem } from "./prompts/translate.js";
import { toMarkdown } from "./lib/frontmatter.js";
import { slugify } from "./lib/slugify.js";
import { siteNewsDir } from "./lib/paths.js";
import { logUsage } from "./lib/usage.js";
import { isCovered, loadState, normalizeUrl, saveState } from "./state.js";
import { getEmbedder } from "./embeddings/index.js";
import { buildSignature, type EventSignature } from "./signature.js";
import { classifyCandidate } from "./dedup.js";

export interface GenerateOptions {
  site: string;
  topic?: string;
  urls: string[];
  dryRun: boolean;
  /** Regenerate even if the sources/slug/event were already covered. */
  force: boolean;
}

async function writeArticle(
  siteSlug: string,
  lang: string,
  slug: string,
  article: ArticleDraft,
  pubDate: Date,
): Promise<string> {
  const dir = siteNewsDir(siteSlug, lang);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${slug}.md`);
  await writeFile(filePath, toMarkdown(article, pubDate), "utf8");
  return filePath;
}

export async function generate(
  opts: GenerateOptions,
  providers: TaskProviders,
): Promise<void> {
  const site = getSite(opts.site);
  const schema = buildArticleSchema(site.categories);
  const state = await loadState(site.slug);
  const normUrls = opts.urls.map(normalizeUrl);

  // Cheap pre-check: exact source URLs already used (skip before any work).
  if (!opts.force && normUrls.length > 0 && isCovered(state, { urls: normUrls })) {
    console.log(
      "⏭  Fonti già coperte in una run precedente. Usa --force per rigenerare.",
    );
    return;
  }

  const sources = opts.urls.length ? await fetchSources(opts.urls) : [];
  if (opts.urls.length > 0 && sources.length === 0) {
    throw new Error("Nessuna delle fonti indicate è stata recuperata: interrompo.");
  }

  // Semantic dedup on the event signature (multilingual embeddings + judge).
  let signature: EventSignature | undefined;
  let candidateEmbedding: number[] | undefined;
  const sigSource = sources.length
    ? { title: sources[0].title, body: sources[0].text }
    : opts.topic
      ? { title: opts.topic, body: opts.topic }
      : undefined;

  if (sigSource) {
    signature = buildSignature(sigSource.title, sigSource.body);
    candidateEmbedding = (await getEmbedder().embed([signature.text]))[0];
    if (!opts.force) {
      const verdict = await classifyCandidate(
        { signature, embedding: candidateEmbedding },
        state,
        providers.judge,
      );
      if (verdict.kind === "duplicate") {
        console.log(
          `⏭  Doppione semantico (score ${verdict.score.toFixed(3)}, via ${verdict.via}) — combacia con: "${verdict.match.title ?? verdict.match.slug}". Usa --force per generare comunque.`,
        );
        return;
      }
      console.log(`  ↳ dedup: nuova notizia (score ${verdict.score.toFixed(3)})`);
    }
  }

  console.log(
    `▶  Genero l'articolo canonico (${site.canonicalLocale}) per ${site.name} con "${providers.generate.name}"${opts.dryRun ? " (dry-run)" : ""}…`,
  );

  const { draft, usage } = await providers.generate.generate({
    system: newsBriefSystem(site),
    instructions: buildInstructions({ topic: opts.topic, sources, site }),
    sources,
    categories: site.categories,
    schema,
  });

  const article = schema.parse(draft) as ArticleDraft;
  logUsage(`${providers.generate.name} · canonico`, usage);

  // Slug from the canonical title, SHARED across languages (translation key).
  const slug = slugify(article.title);
  if (!opts.force && isCovered(state, { slug })) {
    console.log(
      `⏭  Esiste già un articolo con slug "${slug}". Nulla scritto (usa --force per sovrascrivere).`,
    );
    return;
  }

  const pubDate = new Date();

  if (opts.dryRun) {
    console.log("\n----- DRY RUN: nessun file scritto, stato non aggiornato -----\n");
    console.log(toMarkdown(article, pubDate));
    return;
  }

  const written: string[] = [];
  written.push(
    await writeArticle(site.slug, site.canonicalLocale, slug, article, pubDate),
  );

  // Translations: same slug/frontmatter, only the prose changes.
  for (const target of site.targetLocales) {
    if (!providers.translate.translate) {
      console.warn(
        `  ⚠️  Il provider "${providers.translate.name}" non sa tradurre: salto ${target}.`,
      );
      continue;
    }
    const res = await providers.translate.translate({
      system: translateSystem(localeNames[target] ?? target),
      title: article.title,
      description: article.description,
      body: article.body,
    });
    logUsage(`${providers.translate.name} · traduzione ${target}`, res.usage);
    written.push(
      await writeArticle(
        site.slug,
        target,
        slug,
        { ...article, title: res.title, description: res.description, body: res.body },
        pubDate,
      ),
    );
  }

  state.covered.push({
    slug,
    title: article.title,
    summary: signature?.summary,
    embedding: candidateEmbedding,
    urls: normUrls,
    topic: opts.topic,
    at: new Date().toISOString(),
  });
  await saveState(site.slug, state);

  console.log(`✓  Articolo scritto (draft: true) in ${written.length} lingua/e:`);
  for (const f of written) console.log(`   · ${f}`);
}
