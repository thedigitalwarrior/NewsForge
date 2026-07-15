/**
 * Per-site configuration contract. Each site provides one object of this shape
 * (see e.g. sites/tabletnexus/src/config/site.ts); the shared theme reads it and
 * stays free of any site-specific branding.
 */
export interface SiteCategory {
  /** URL slug, e.g. "novita". */
  slug: string;
  /** Human label as it appears in article frontmatter, e.g. "Novità". */
  label: string;
}

export interface SiteConfig {
  /** Display name, e.g. "TabletNexus". */
  name: string;
  /** Bare domain, e.g. "tabletnexus.com". */
  domain: string;
  /** One-line tagline under the logo. */
  tagline: string;
  /** Meta description fallback for pages without their own. */
  description: string;
  /** Brand accent colors (any valid CSS color). */
  brand: {
    accent: string;
    accentDark: string;
  };
  /** Categories this site uses, in nav order. */
  categories: SiteCategory[];
}
