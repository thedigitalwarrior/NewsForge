import { defaultLocale, type Locale } from "./config";

/** UI strings per locale. Content comes from articles; these are the chrome. */
export const ui = {
  en: {
    "nav.search": "Search",
    "home.latest": "Latest articles",
    "article.sources": "Sources",
    "article.back": "← Back to home",
    "article.draft": "draft",
    "category.eyebrow": "Category",
    "category.empty": "No articles in this category yet.",
    "search.title": "Search",
    "search.placeholder": "Search articles…",
    "search.zeroResults": "No results for «[SEARCH_TERM]»",
    "search.noscript": "Search requires JavaScript.",
    "footer.aiNotice": "Content produced with the help of AI tools —",
    "footer.aiLink": "learn how",
    "nav.about": "About",
    "lang.label": "Language",
  },
  it: {
    "nav.search": "Cerca",
    "home.latest": "Ultimi articoli",
    "article.sources": "Fonti",
    "article.back": "← Torna alla home",
    "article.draft": "bozza",
    "category.eyebrow": "Categoria",
    "category.empty": "Nessun articolo in questa categoria, per ora.",
    "search.title": "Cerca",
    "search.placeholder": "Cerca articoli…",
    "search.zeroResults": "Nessun risultato per «[SEARCH_TERM]»",
    "search.noscript": "La ricerca richiede JavaScript attivo.",
    "footer.aiNotice": "Contenuti realizzati con l'ausilio di strumenti di AI —",
    "footer.aiLink": "scopri come",
    "nav.about": "Chi siamo",
    "lang.label": "Lingua",
  },
} as const;

export type UiKey = keyof (typeof ui)["en"];

export function useTranslations(lang: Locale) {
  return function t(key: UiKey): string {
    const table = ui[lang] as Record<string, string>;
    return table[key] ?? ui[defaultLocale][key] ?? key;
  };
}
