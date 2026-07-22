import type { SiteConfig } from "@shared/config/site";

export const site: SiteConfig = {
  name: "TabletNexus",
  domain: "tabletnexus.com",
  tagline: {
    en: "Tablets: news, comparisons, prices",
    it: "Tablet: novità, confronti, prezzi",
  },
  description: {
    en: "News, comparisons and buying guides on tablets, without the clickbait.",
    it: "Novità, confronti e guide all'acquisto sul mondo dei tablet, senza clickbait.",
  },
  brand: {
    accent: "#0ea5e9",
    accentDark: "#0369a1",
  },
  categories: [
    { key: "news", labels: { en: "News", it: "News" } },
    { key: "comparisons", labels: { en: "Comparisons", it: "Confronti" } },
    { key: "prices", labels: { en: "Prices", it: "Prezzi" } },
    { key: "guides", labels: { en: "Guides", it: "Guide" } },
    { key: "accessories", labels: { en: "Accessories", it: "Accessori" } },
  ],
};
