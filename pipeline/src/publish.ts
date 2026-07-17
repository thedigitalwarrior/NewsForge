import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSite } from "./sites.js";
import { siteNewsDir } from "./lib/paths.js";

interface ArticleInfo {
  slug: string;
  file: string;
  title: string;
  draft: boolean;
}

function frontmatterOf(raw: string): string {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : "";
}

async function listArticles(siteSlug: string): Promise<ArticleInfo[]> {
  const dir = siteNewsDir(siteSlug);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => /\.(md|mdx)$/.test(f));
  const infos: ArticleInfo[] = [];
  for (const file of files) {
    const raw = await readFile(path.join(dir, file), "utf8");
    const fm = frontmatterOf(raw);
    const titleMatch = fm.match(/^title:\s*(.+)$/m);
    let title = titleMatch ? titleMatch[1].trim() : file;
    try {
      if (title.startsWith('"')) title = JSON.parse(title) as string;
    } catch {
      /* leave as-is */
    }
    const draft = /^draft:\s*true\b/m.test(fm);
    infos.push({ slug: file.replace(/\.(md|mdx)$/, ""), file, title, draft });
  }
  return infos.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Print the review queue: which articles are published vs still draft. */
export async function review(siteSlug: string): Promise<void> {
  const site = getSite(siteSlug);
  const articles = await listArticles(site.slug);
  if (articles.length === 0) {
    console.log(`Nessun articolo in ${site.name}.`);
    return;
  }
  const drafts = articles.filter((a) => a.draft);
  console.log(`Coda di revisione — ${site.name} (${articles.length} articoli, ${drafts.length} bozze)\n`);
  for (const a of articles) {
    const badge = a.draft ? "📝 bozza    " : "✅ pubblicato";
    console.log(`  ${badge}  ${a.slug}\n               ${a.title}`);
  }
  if (drafts.length > 0) {
    console.log(
      `\nPer pubblicare: npm run publish -- --site ${site.slug} --slug <slug>  (oppure --all)`,
    );
  }
}

/** Flip draft: true -> false on one article (by slug) or all drafts (--all). */
export async function publish(
  siteSlug: string,
  opts: { slug?: string; all?: boolean },
): Promise<void> {
  const site = getSite(siteSlug);
  const dir = siteNewsDir(site.slug);
  const articles = await listArticles(site.slug);
  const drafts = articles.filter((a) => a.draft);

  let targets: ArticleInfo[];
  if (opts.all) {
    targets = drafts;
  } else if (opts.slug) {
    const found = articles.find((a) => a.slug === opts.slug);
    if (!found) throw new Error(`Slug non trovato: "${opts.slug}".`);
    if (!found.draft) {
      console.log(`"${found.slug}" è già pubblicato. Nulla da fare.`);
      return;
    }
    targets = [found];
  } else {
    throw new Error("Specifica --slug <slug> oppure --all.");
  }

  if (targets.length === 0) {
    console.log("Nessuna bozza da pubblicare.");
    return;
  }

  for (const a of targets) {
    const filePath = path.join(dir, a.file);
    const raw = await readFile(filePath, "utf8");
    // Only touch the frontmatter draft line.
    const updated = raw.replace(/^draft:\s*true\b/m, "draft: false");
    await writeFile(filePath, updated, "utf8");
    console.log(`✓  Pubblicato: ${a.slug}`);
  }
}
