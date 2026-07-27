import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// src -> pipeline
const here = path.dirname(fileURLToPath(import.meta.url));
const stateDir = path.resolve(here, "..", "state");

export interface CoveredEntry {
  slug: string;
  /** Article title (readable, used in logs and by the judge). */
  title?: string;
  /** Source lead used to build the event signature (used by the judge). */
  summary?: string;
  /** Event-signature embedding (semantic dedup). Absent on legacy entries. */
  embedding?: number[];
  urls: string[];
  topic?: string;
  at: string;
}

export interface SiteState {
  version?: number;
  covered: CoveredEntry[];
}

export const STATE_VERSION = 3;

function stateFile(site: string): string {
  return path.join(stateDir, `${site}.json`);
}

export async function loadState(site: string): Promise<SiteState> {
  const file = stateFile(site);
  if (!existsSync(file)) return { version: STATE_VERSION, covered: [] };
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as SiteState;
    return { version: parsed.version, covered: parsed.covered ?? [] };
  } catch {
    return { version: STATE_VERSION, covered: [] };
  }
}

export async function saveState(site: string, state: SiteState): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  const payload: SiteState = { version: STATE_VERSION, covered: state.covered };
  await writeFile(stateFile(site), JSON.stringify(payload, null, 2) + "\n", "utf8");
}

/**
 * Normalize a URL for comparison: drop the fragment, lowercase the host, strip a
 * leading "www." and any trailing slash, and remove common tracking parameters.
 * Without this the same article counts twice (e.g. example.com vs www.example.com).
 */
const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_|ref$|srsltid$)/i;

export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return raw.trim();
  }
}

/**
 * Already covered if the same slug was produced before, or if the exact set of
 * source URLs has already been used. Lets scheduled/repeated runs stay idempotent.
 */
export function isCovered(
  state: SiteState,
  keys: { urls?: string[]; slug?: string },
): boolean {
  const urls = (keys.urls ?? []).map(normalizeUrl);
  return state.covered.some((entry) => {
    if (keys.slug && entry.slug === keys.slug) return true;
    if (urls.length > 0 && urls.every((u) => entry.urls.includes(u))) return true;
    return false;
  });
}
