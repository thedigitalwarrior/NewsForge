import type { SiteConfig } from "@shared/config/site";

export const site: SiteConfig = {
  name: "TabletNexus",
  domain: "tabletnexus.com",
  tagline: "Tablet: novità, confronti, prezzi",
  description:
    "Novità, confronti e guide all'acquisto sul mondo dei tablet, senza clickbait.",
  brand: {
    accent: "#0ea5e9",
    accentDark: "#0369a1",
  },
  categories: [
    { slug: "novita", label: "Novità" },
    { slug: "confronti", label: "Confronti" },
    { slug: "prezzi", label: "Prezzi" },
    { slug: "guide", label: "Guide" },
    { slug: "accessori", label: "Accessori" },
  ],
};
