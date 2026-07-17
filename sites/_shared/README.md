# Tema condiviso (`@newsforge/shared`)

Il 90% di ogni sito news vive qui. I siti in `sites/<dominio>/` importano da questo
pacchetto via alias `@shared/*` e forniscono solo branding, categorie e contenuti.

## Struttura

- `src/content/config.ts` — schema Zod del frontmatter (`newsSchema`), fonte di verità.
- `src/config/site.ts` — tipo `SiteConfig` che ogni sito implementa (nome, dominio, tagline,
  colori brand, categorie).
- `src/styles/global.css` — entry Tailwind v4 + token. L'accento brand è una CSS var
  (`--brand` / `--brand-dark`) impostata a runtime da `BaseLayout` dal config del sito, così
  i componenti restano brand-agnostici (utility `*-brand` / `*-brand-dark`).
- `src/layouts/` — `BaseLayout.astro` (shell HTML, header, footer, brand var),
  `ArticleLayout.astro` (rende il contenuto con i componenti MDX, fonti, hero image).
- `src/components/` — `SiteHeader`, `SiteFooter`, `ArticleCard`, `CategoryBadge`,
  `FormattedDate`, `Search` (UI Pagefind, funziona solo dopo `build`).
- `src/components/mdx/` — componenti per gli articoli MDX (`SchedaTecnica`, `ProsCons`,
  `TabellaPrezzi`), esposti dal barrel `index.ts` (`mdxComponents`) e passati a `<Content>`
  in `ArticleLayout`, così la pipeline può usarli senza `import` espliciti nell'MDX.
- `src/lib/utils.ts` — utility condivise (es. `slugify`).
- `src/lib/news.ts` — `getVisibleNews()`, unico punto che decide quali articoli sono visibili
  (home, categorie, route articolo, RSS, sitemap). Filtra le bozze in produzione, le mostra in
  dev (anteprima per la coda di revisione).

Nota: le vecchie `fixtures/` sono state migrate nei contenuti reali dei siti (Fase 6). Ogni
sito ora legge i propri articoli da `sites/<dominio>/src/content/news/`.

## Come un sito consuma il tema

1. `src/config/site.ts` esporta un oggetto `SiteConfig`.
2. Le pagine importano layout/componenti da `@shared/*` e passano `site` ai layout.
3. `src/content.config.ts` importa `newsSchema` da `@shared/content/config`.
