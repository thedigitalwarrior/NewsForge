import type { SiteConfig } from "@shared/config/site";

export const site: SiteConfig = {
  name: "FreeGamersWorld",
  domain: "freegamersworld.com",
  tagline: {
    en: "Free games, tracked: Epic, Steam, GOG, Prime",
    it: "Giochi gratis, monitorati: Epic, Steam, GOG, Prime",
  },
  description: {
    en: "Every game given away for free on the Epic Games Store, Steam, GOG and Prime Gaming — with the dates you need to claim them.",
    it: "Tutti i giochi regalati su Epic Games Store, Steam, GOG e Prime Gaming — con le date entro cui riscattarli.",
  },
  brand: {
    accent: "#7c3aed",
    accentDark: "#5b21b6",
  },
  categories: [
    { key: "news", labels: { en: "News", it: "News" } },
    { key: "epic", labels: { en: "Epic Games", it: "Epic Games" } },
    { key: "steam", labels: { en: "Steam", it: "Steam" } },
    { key: "gog", labels: { en: "GOG", it: "GOG" } },
    { key: "prime", labels: { en: "Prime Gaming", it: "Prime Gaming" } },
  ],
};
