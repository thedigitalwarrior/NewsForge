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

export interface GenerateOptions {
  site: string;
  provider: string;
  topic?: string;
  urls: string[];
  dryRun: boolean;
}

export async function generate(opts: GenerateOptions): Promise<void> {
  const site = getSite(opts.site);
  const schema = buildArticleSchema(site.categories);

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

  // Final safety validation against the shared contract before writing anything.
  const article = schema.parse(draft) as ArticleDraft;
  logUsage(provider.name, usage);

  const markdown = toMarkdown(article, new Date());

  if (opts.dryRun) {
    console.log("\n----- DRY RUN: nessun file scritto -----\n");
    console.log(markdown);
    return;
  }

  const dir = siteNewsDir(site.slug);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${slugify(article.title)}.md`);
  await writeFile(filePath, markdown, "utf8");
  console.log(`✓  Articolo scritto (draft: true): ${filePath}`);
}
