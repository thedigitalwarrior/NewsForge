import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ArticleDraft } from "./article.js";
import { buildArticleSchema } from "./article.js";
import { getSite } from "./sites.js";
import { getProvider } from "./providers/index.js";
import { fetchSources } from "./research/fetch.js";
import { buildInstructions, newsBriefSystem } from "./prompts/news-brief.js";
import { toMarkdown } from "./lib/frontmatter.js";
import { slugify } from "./lib/slugify.js";
import { siteNewsDir } from "./lib/paths.js";
import { logUsage } from "./lib/usage.js";
import { isCovered, loadState, normalizeUrl, saveState } from "./state.js";

export interface GenerateOptions {
  site: string;
  provider: string;
  topic?: string;
  urls: string[];
  dryRun: boolean;
  /** Regenerate even if the sources/slug were already covered. */
  force: boolean;
}

export async function generate(opts: GenerateOptions): Promise<void> {
  const site = getSite(opts.site);
  const schema = buildArticleSchema(site.categories);
  const state = await loadState(site.slug);
  const normUrls = opts.urls.map(normalizeUrl);

  // Dedup pre-check: skip before spending any tokens if these sources were used.
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

  const provider = getProvider(opts.provider);
  console.log(
    `▶  Genero un articolo per ${site.name} con provider "${opts.provider}"${opts.dryRun ? " (dry-run)" : ""}…`,
  );

  const { draft, usage } = await provider.generate({
    system: newsBriefSystem(site),
    instructions: buildInstructions({ topic: opts.topic, sources, site }),
    sources,
    categories: site.categories,
    schema,
  });

  const article = schema.parse(draft) as ArticleDraft;
  logUsage(provider.name, usage);

  const slug = slugify(article.title);
  if (!opts.force && isCovered(state, { slug })) {
    console.log(
      `⏭  Esiste già un articolo con slug "${slug}". Nulla scritto (usa --force per sovrascrivere).`,
    );
    return;
  }

  const markdown = toMarkdown(article, new Date());

  if (opts.dryRun) {
    console.log("\n----- DRY RUN: nessun file scritto, stato non aggiornato -----\n");
    console.log(markdown);
    return;
  }

  const dir = siteNewsDir(site.slug);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${slug}.md`);
  await writeFile(filePath, markdown, "utf8");

  state.covered.push({
    slug,
    urls: normUrls,
    topic: opts.topic,
    at: new Date().toISOString(),
  });
  await saveState(site.slug, state);

  console.log(`✓  Articolo scritto (draft: true): ${filePath}`);
}
