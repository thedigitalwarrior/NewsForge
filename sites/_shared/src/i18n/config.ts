export const locales = ["en", "it"] as const;
export type Locale = (typeof locales)[number];

/** Canonical/default language of the network. Everything is generated in EN first. */
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  it: "Italiano",
};

/** BCP-47 tags for Intl date formatting. */
export const localeTags: Record<Locale, string> = {
  en: "en-US",
  it: "it-IT",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
