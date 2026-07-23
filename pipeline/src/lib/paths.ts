import { fileURLToPath } from "node:url";
import path from "node:path";

// src/lib -> src -> pipeline -> repo root
const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "..", "..", "..");

/** Root of a site's news content (contains one directory per locale). */
export function siteNewsRoot(slug: string): string {
  return path.join(repoRoot, "sites", slug, "src", "content", "news");
}

/** Per-locale content directory the pipeline writes into (draft-first). */
export function siteNewsDir(slug: string, lang: string): string {
  return path.join(siteNewsRoot(slug), lang);
}
