import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// src -> pipeline
const here = path.dirname(fileURLToPath(import.meta.url));
const stateDir = path.resolve(here, "..", "state");

export interface CoveredEntry {
  slug: string;
  urls: string[];
  topic?: string;
  at: string;
}

export interface SiteState {
  covered: CoveredEntry[];
}

function stateFile(site: string): string {
  return path.join(stateDir, `${site}.json`);
}

export async function loadState(site: string): Promise<SiteState> {
  const file = stateFile(site);
  if (!existsSync(file)) return { covered: [] };
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as SiteState;
    return { covered: parsed.covered ?? [] };
  } catch {
    return { covered: [] };
  }
}

export async function saveState(site: string, state: SiteState): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  await writeFile(stateFile(site), JSON.stringify(state, null, 2) + "\n", "utf8");
}

/** Normalize a URL for comparison (drop hash, trim). */
export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
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
