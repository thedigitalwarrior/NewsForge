import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSite } from "./sites.js";
import { siteNewsRoot } from "./lib/paths.js";

interface ArticleVersion {
  lang: string;
  file: string;
  title: string;
  draft: boolean;
}

/** One article = one slug with a version per language. */
interface ArticleGroup {
  slug: string;
  versions: ArticleVersion[];
}

function frontmatterOf(raw: string): string {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : "";
}

async function listArticles(siteSlug: string): Promise<ArticleGroup[]> {
  const root = siteNewsRoot(siteSlug);
  if (!existsSync(root)) return [];

  const groups = new Map<string, ArticleVersion[]>();
  const langs = (await readdir(root, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const lang of langs) {
    const dir = path.join(root, lang);
    const files = (await readdir(dir)).filter((f) => /\.(md|mdx)$/.test(f));
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
      const slug = file.replace(/\.(md|mdx)$/, "");
      const version: ArticleVersion = {
        lang,
        file: path.join(lang, file),
        title,
        draft: /^draft:\s*true\b/m.test(fm),
      };
      groups.set(slug, [...(groups.get(slug) ?? []), version]);
    }
  }

  return [...groups.entries()]
    .map(([slug, versions]) => ({
      slug,
      versions: versions.sort((a, b) => a.lang.localeCompare(b.lang)),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Print the review queue: one line per article, with per-language status. */
export async function review(siteSlug: string): Promise<void> {
  const site = getSite(siteSlug);
  const groups = await listArticles(site.slug);
  if (groups.length === 0) {
    console.log(`Nessun articolo in ${site.name}.`);
    return;
  }

  const withDrafts = groups.filter((g) => g.versions.some((v) => v.draft));
  console.log(
    `Coda di revisione — ${site.name} (${groups.length} articoli, ${withDrafts.length} con bozze)\n`,
  );

  for (const g of groups) {
    const anyDraft = g.versions.some((v) => v.draft);
    const badge = anyDraft ? "📝 bozza     " : "✅ pubblicato";
    const langs = g.versions
      .map((v) => `${v.lang}:${v.draft ? "bozza" : "pubbl."}`)
      .join(", ");
    // Show the canonical title when present, else the first available.
    const canonical =
      g.versions.find((v) => v.lang === site.canonicalLocale) ?? g.versions[0];
    console.log(`  ${badge}  ${g.slug}  [${langs}]`);
    console.log(`               ${canonical.title}`);
  }

  if (withDrafts.length > 0) {
    console.log(
      `\nPer pubblicare: npm run publish -- --site ${site.slug} --slug <slug>  (oppure --all)`,
    );
  }
}

/**
 * Publish an article: flips draft:true -> false on ALL its language versions,
 * because the translations are versions of the same article, not separate ones.
 */
export async function publish(
  siteSlug: string,
  opts: { slug?: string; all?: boolean },
): Promise<void> {
  const site = getSite(siteSlug);
  const root = siteNewsRoot(site.slug);
  const groups = await listArticles(site.slug);

  let targets: ArticleGroup[];
  if (opts.all) {
    targets = groups.filter((g) => g.versions.some((v) => v.draft));
  } else if (opts.slug) {
    const found = groups.find((g) => g.slug === opts.slug);
    if (!found) throw new Error(`Slug non trovato: "${opts.slug}".`);
    if (!found.versions.some((v) => v.draft)) {
      console.log(`"${found.slug}" è già pubblicato in tutte le lingue.`);
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

  for (const group of targets) {
    const published: string[] = [];
    for (const version of group.versions) {
      if (!version.draft) continue;
      const filePath = path.join(root, version.file);
      const raw = await readFile(filePath, "utf8");
      await writeFile(filePath, raw.replace(/^draft:\s*true\b/m, "draft: false"), "utf8");
      published.push(version.lang);
    }
    console.log(`✓  Pubblicato: ${group.slug} (${published.join(", ")})`);
  }
}
