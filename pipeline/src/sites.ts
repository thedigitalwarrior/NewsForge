/**
 * Sites the pipeline can target. `categories` mirrors each site's own config in
 * sites/<slug>/src/config/site.ts (keep in sync). Source hints are only used to
 * nudge the prompt; the actual sources come from --url and are fetched locally.
 */
export interface SiteDefinition {
  slug: string;
  name: string;
  categories: readonly [string, ...string[]];
  defaultSourceHints: string[];
}

export const sites: Record<string, SiteDefinition> = {
  tabletnexus: {
    slug: "tabletnexus",
    name: "TabletNexus",
    categories: ["Novità", "Confronti", "Prezzi", "Guide", "Accessori"],
    defaultSourceHints: [
      "apple.com/newsroom",
      "anandtech.com",
      "gsmarena.com",
      "notebookcheck.net",
      "theverge.com",
    ],
  },
};

export function getSite(slug: string): SiteDefinition {
  const site = sites[slug];
  if (!site) {
    throw new Error(
      `Sito sconosciuto: "${slug}". Disponibili: ${Object.keys(sites).join(", ")}.`,
    );
  }
  return site;
}
