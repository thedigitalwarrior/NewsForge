/**
 * Sites the pipeline can target. Categories are the language-neutral KEYS used in
 * frontmatter (labels are localized in each site's own config — keep in sync).
 * Articles are generated in the canonical locale and translated into the targets.
 */
export interface SiteDefinition {
  slug: string;
  name: string;
  /** Language articles are written in (the canonical version). */
  canonicalLocale: string;
  /** Locales the canonical gets translated into. */
  targetLocales: string[];
  categories: readonly [string, ...string[]];
  defaultSourceHints: string[];
  /**
   * Editorial beats: the queries the discovery step runs against the search
   * engine. They define what the site covers — widen or narrow them at will.
   */
  searchQueries: string[];
  /**
   * Country bias for the search engine (ISO code). Cuts regional SEO filler at
   * the source, before it even reaches the triage.
   */
  searchCountry: string;
  /**
   * Editorial scope, in prose, for the LLM relevance filter: what belongs on this
   * site and what does not. This is a judgment call, so it's the LLM's job — not
   * embedding similarity, which conflates surface features (a foldable *phone*
   * looks close to "Galaxy Tab"; a WhatsApp-for-iPad story looks like an app).
   */
  editorialScope: string;
}

/** Human-readable language names, for the translation prompt. */
export const localeNames: Record<string, string> = {
  en: "English",
  it: "Italian",
};

export const sites: Record<string, SiteDefinition> = {
  tabletnexus: {
    slug: "tabletnexus",
    name: "TabletNexus",
    canonicalLocale: "en",
    targetLocales: ["it"],
    categories: ["news", "comparisons", "prices", "guides", "accessories"],
    defaultSourceHints: [
      "apple.com/newsroom",
      "anandtech.com",
      "gsmarena.com",
      "notebookcheck.net",
      "theverge.com",
    ],
    searchQueries: [
      "tablet announcement",
      "iPad news",
      "Samsung Galaxy Tab",
      "Android tablet launch",
      "e-ink tablet",
      "tablet price drop",
    ],
    searchCountry: "us",
    editorialScope: [
      "The site covers TABLET PRODUCT NEWS only. Be strict.",
      "ON TOPIC: new tablet launches and announcements; tablet hardware and specifications; the tablet's own operating-system/software updates (iPadOS, Android tablet software, HarmonyOS on tablets); tablet hands-on reviews; tablet prices, deals and discounts; tablet buying comparisons; and tablet accessories such as keyboards and styluses. Covered brands: iPad, Samsung Galaxy Tab, Lenovo, Xiaomi, Huawei MatePad, Honor, Teclast, OnePlus Pad, Moto Pad, and e-ink/e-paper tablets.",
      "OFF TOPIC — exclude even when a tablet is mentioned: smartphones and foldable phones (Galaxy Z Fold, iPhone); smartwatches; laptops and Macs; TVs. Opinion, editorial or 'wishlist' pieces (e.g. 'One app is all Apple needs to make the iPad perfect'). Listicles about services rather than tablets (e.g. best cellular data plans). Non-product stories such as corporate or fleet deployments (e.g. tablets installed on cruise ships) and education or policy stories (e.g. tablets in schools). Third-party app news even when it involves a tablet (e.g. WhatsApp adding iPad features) — this site covers tablets, not apps. Business/finance, politics, science and general world news.",
      "ALSO EXCLUDE generic SEO round-ups: evergreen 'best/cheapest N tablets' or 'top N tablets for students/work' listicles with no news peg, and articles built around one country's local pricing or availability. A comparison qualifies only if it is tied to a specific, recent development (a launch, a price change, a new model) rather than an undated shopping list.",
      "ALSO EXCLUDE advertorial / promotional 'bargain' posts that push a single budget tablet as a great deal, typically with local non-USD pricing (e.g. Rp, ₹, IDR) and clickbait phrasing ('No need to buy an expensive laptop', 'Cheap but powerful'). These are affiliate/SEO content, not news. Genuine price NEWS — an official price cut, or the launch price of a notable model — is fine; a shopping-advice bargain post is not.",
    ].join(" "),
  },
  freegamersworld: {
    slug: "freegamersworld",
    name: "FreeGamersWorld",
    canonicalLocale: "en",
    targetLocales: ["it"],
    categories: ["news", "epic", "steam", "gog", "prime"],
    defaultSourceHints: [
      "store.epicgames.com/en-US/free-games",
      "store.steampowered.com",
      "gog.com",
      "gaming.amazon.com",
      "pcgamer.com",
    ],
    searchQueries: [
      "free game epic games store",
      "steam free to keep limited time",
      "GOG free game giveaway",
      "prime gaming free games",
      "free PC game giveaway claim",
      "free game keep forever",
    ],
    searchCountry: "us",
    editorialScope: [
      "The site covers PC GAMES THAT ARE BEING GIVEN AWAY FOR FREE (or 'free to keep' for a limited time) on the Epic Games Store, Steam, GOG and Amazon Prime Gaming. Be strict.",
      "ON TOPIC: a specific game made free to claim/keep on one of those stores (with a claim window); an announced upcoming free giveaway; a notable free-game news item such as a store changing how its free games work. Always about a concrete title or a concrete giveaway, tied to a claim deadline.",
      "OFF TOPIC — exclude even when a game is mentioned: paid games merely on SALE or discounted (a price cut is not a free giveaway); permanently free-to-play titles (they never expire, so there is no claim window and it isn't news); game reviews, previews, guides, tier lists and general gaming news; hardware, consoles and accessories; esports; deals on subscriptions or gift cards; mobile in-app 'free' items. General world, business and tech news.",
      "ALSO EXCLUDE generic SEO round-ups ('best free games to play right now', 'top N free-to-play games') with no specific new giveaway and no claim deadline.",
    ].join(" "),
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
