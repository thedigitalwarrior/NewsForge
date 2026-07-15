import SchedaTecnica from "./SchedaTecnica.astro";
import ProsCons from "./ProsCons.astro";
import TabellaPrezzi from "./TabellaPrezzi.astro";

/**
 * Components made available to every MDX article without an explicit import.
 * Passed to `<Content components={mdxComponents} />` in ArticleLayout, so the
 * pipeline can emit <SchedaTecnica />, <ProsCons />, <TabellaPrezzi /> directly.
 */
export const mdxComponents = {
  SchedaTecnica,
  ProsCons,
  TabellaPrezzi,
};
