import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { getSite } from "./sites.js";

/**
 * Finds OFFICIAL images to illustrate an article — the game maker's store assets
 * or the manufacturer's own press page — for a human to pick from in the console.
 * Never scrapes arbitrary news-site photos: the ogimage strategy is gated to a
 * per-site whitelist of official domains, and steam uses the store's own API/CDN.
 */
export interface ImageCandidate {
  url: string;
  /** Where it came from, e.g. "steam" or "og:apple.com". */
  provider: string;
  /** Short human hint shown under the thumbnail. */
  label: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

const STEAM_APP_RE = /store\.steampowered\.com\/app\/(\d+)/i;
const UA =
  "Mozilla/5.0 (compatible; NewsForgeBot/1.0; +https://newsforge.local)";

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Read title + source URLs from a draft's canonical-locale frontmatter. */
export function readArticleMeta(
  siteSlug: string,
  slug: string,
): { title: string; sources: string[] } {
  const site = getSite(siteSlug);
  const file = path.join(
    repoRoot,
    "sites",
    siteSlug,
    "src",
    "content",
    "news",
    site.canonicalLocale,
    `${slug}.md`,
  );
  if (!existsSync(file)) return { title: "", sources: [] };
  const text = readFileSync(file, "utf8");
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return { title: "", sources: [] };
  const block = fm[1];
  const titleM = block.match(/^title:\s*["']?(.*?)["']?\s*$/m);
  const title = titleM ? titleM[1].trim() : "";
  const sm = block.match(/^sources:\s*\n((?:\s*-\s*.*\n?)+)/m);
  const sources = sm
    ? [...sm[1].matchAll(/-\s*["']?([^"'\n]+)["']?\s*$/gm)].map((x) => x[1].trim())
    : [];
  return { title, sources };
}

/** Official assets for one Steam appid (header + a few screenshots). */
async function steamAssetsForApp(
  appid: string,
  suffix: string,
  maxShots: number,
): Promise<ImageCandidate[]> {
  const out: ImageCandidate[] = [];
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appid}&l=english`,
      { headers: { "user-agent": UA } },
    );
    const data = (await res.json()) as Record<
      string,
      { data?: { name?: string; header_image?: string; screenshots?: { path_full?: string }[] } }
    >;
    const d = data?.[appid]?.data;
    if (!d) return out;
    const name = d.name ?? "gioco";
    if (d.header_image) {
      out.push({ url: d.header_image, provider: "steam", label: `${name} — header${suffix}` });
    }
    for (const s of (d.screenshots ?? []).slice(0, maxShots)) {
      if (s.path_full) {
        out.push({ url: s.path_full, provider: "steam", label: `${name} — screenshot${suffix}` });
      }
    }
  } catch {
    // unresolved appid is skipped
  }
  return out;
}

/** Steam assets from an appid found directly in the article's source URLs. */
async function steamFromUrls(sources: string[]): Promise<ImageCandidate[]> {
  const out: ImageCandidate[] = [];
  const seen = new Set<string>();
  for (const src of sources) {
    const m = src.match(STEAM_APP_RE);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push(...(await steamAssetsForApp(m[1], "", 4)));
  }
  return out;
}

/** Strip the giveaway boilerplate off a headline to recover the game name. */
export function gameNameFromTitle(title: string): string {
  // Split on spaced headline separators only (keep ":" — game subtitles use it).
  const base = title.split(/\s+[-–—|]\s+/)[0].trim();
  const marker =
    /\s+\b(is|are|available|free|now|gets?|goes?|hits?|comes?|coming|launch(?:es|ing)?|releases?|joins?|arrives?|leaving|on|for|this|until|will|can|you|to)\b/i;
  const m = base.match(marker);
  const name = m && m.index && m.index > 1 ? base.slice(0, m.index).trim() : base;
  return name.length >= 2 ? name : base;
}

/** Fallback: resolve the game by NAME via Steam search, then fetch its assets. */
async function steamFromTitle(title: string): Promise<ImageCandidate[]> {
  const term = gameNameFromTitle(title);
  if (!term) return [];
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&cc=us&l=english`,
      { headers: { "user-agent": UA } },
    );
    const data = (await res.json()) as { items?: { id?: number; name?: string }[] };
    const items = (data.items ?? []).filter((i) => i.id).slice(0, 2);
    const out: ImageCandidate[] = [];
    for (let i = 0; i < items.length; i++) {
      // header for each match; screenshots only for the top match
      out.push(...(await steamAssetsForApp(String(items[i].id), " (ricerca)", i === 0 ? 3 : 0)));
    }
    return out;
  } catch {
    return [];
  }
}

async function ogImageCandidates(
  sources: string[],
  domains: string[],
): Promise<ImageCandidate[]> {
  const out: ImageCandidate[] = [];
  const allowed = (h: string): boolean =>
    domains.some((d) => h === d || h.endsWith("." + d));
  for (const src of sources) {
    const h = hostOf(src);
    if (!h || !allowed(h)) continue;
    try {
      const res = await fetch(src, { headers: { "user-agent": UA } });
      const html = await res.text();
      const $ = cheerio.load(html);
      const raw =
        $('meta[property="og:image"]').attr("content") ||
        $('meta[name="twitter:image"]').attr("content") ||
        $('meta[name="twitter:image:src"]').attr("content");
      if (raw) {
        out.push({
          url: new URL(raw, src).href,
          provider: `og:${h}`,
          label: `Immagine ufficiale (${h})`,
        });
      }
    } catch {
      // unreachable / non-HTML source is skipped
    }
  }
  return out;
}

/**
 * Keep only URLs on an official domain with a real path (drops bare homepages).
 * Used to enrich an article's sources with the official store/maker page that the
 * news sources link to, so the image finder can resolve official assets.
 */
export function filterOfficialUrls(urls: string[], domains: string[]): string[] {
  const allowed = (h: string): boolean =>
    domains.some((d) => h === d || h.endsWith("." + d));
  const out = new Set<string>();
  for (const u of urls) {
    const h = hostOf(u);
    if (!h || !allowed(h)) continue;
    try {
      if (new URL(u).pathname.replace(/\/+$/, "").length <= 0) continue;
    } catch {
      continue;
    }
    out.add(u);
  }
  return [...out];
}

/** Official image candidates for an article's sources, per the site's strategies. */
export async function findImageCandidates(
  siteSlug: string,
  sources: string[],
  title = "",
): Promise<ImageCandidate[]> {
  const site = getSite(siteSlug);
  const strategies = site.imageSources ?? [];
  const out: ImageCandidate[] = [];
  for (const s of strategies) {
    if (s === "steam") {
      const fromUrls = await steamFromUrls(sources);
      out.push(...fromUrls);
      // Fallback: if no source linked the Steam page, resolve the game by name.
      if (fromUrls.length === 0 && title) out.push(...(await steamFromTitle(title)));
    } else if (s === "ogimage") {
      out.push(...(await ogImageCandidates(sources, site.officialImageDomains ?? [])));
    }
  }
  // Dedup by URL, keep order.
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}
