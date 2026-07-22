# Registro decisioni architetturali

Formato: data — decisione — motivazione — alternative scartate.
Aggiungere una voce ogni volta che si prende una decisione non banale. Non riaprire
decisioni chiuse senza fatti nuovi.

## 2026-07 — Siti statici con Astro
Generazione HTML in build, zero runtime server-side. Motivi: sicurezza (nessuna superficie
d'attacco applicativa), prestazioni anche su hardware modesto, SEO, perfetto incastro con
pipeline che produce Markdown. Astro preferito a Hugo per ecosistema npm, content collections
con validazione Zod (protegge dagli errori dell'agente), MDX, e familiarità di Claude Code
con TypeScript. Scartati: WordPress/CMS dinamici (manutenzione e sicurezza), Hugo (template
Go meno flessibili per questo caso).

## 2026-07 — Ricerca con Pagefind
Indice statico spezzato in frammenti, generato post-build, servito come file. Zero processi
server. Scartati per ora: Meilisearch/Typesense (rivalutare solo con migliaia di articoli o
esigenza di ricerca istantanea), Algolia (dati fuori, vendor lock-in), Fuse.js (indice
monolitico, non scala).

## 2026-07 — Contenuti: Markdown/MDX + frontmatter, draft-first
La pipeline scrive solo contenuto con `draft: true`; la presentazione è tutta nel tema.
Pubblicazione = passaggio esplicito (coda di revisione). Motivo: qualità controllabile,
l'agente non può rompere l'impaginazione né pubblicare da solo.

## 2026-07 — Caddy come web server
TLS automatico, config minima per virtual host. Scartati: nginx+certbot (più parti mobili),
Apache (familiare ma sovradimensionato per file statici).

## 2026-07 — Server: SeFlow QA-2124.2 (37,99 €+IVA/mese)
Xeon E-2124 (2018), 64GB RAM, 2x480GB SSD, console KVM/noVNC, reinstallazione self-service,
ISO propria caricabile, DDoS 9 Gbps incluso, fatturazione mensile senza vincoli. Sostituisce
il Dell R210 (2010) in scadenza da Aruba a 43 €+IVA (verificare condizioni disdetta, scadenza
2026-08-08). Preferito 64GB di RAM al QA-2234 (CPU migliore, 800GB disco, 32GB RAM): la RAM è
la risorsa vincolante per un laboratorio Proxmox; lo spazio è mitigato da compressione ZFS,
thin provisioning e backup off-site. Scartati: QB-1230/1231 (piattaforme 2011/2014),
QA-VI630 (CPU 2013 senza AVX2, dischi meccanici SAS), VPS puro (il server è anche laboratorio
personale per esperimenti e progetti futuri).

## 2026-07 — Virtualizzazione: Proxmox VE su ZFS mirror
Controller PERC lasciato in HBA, mirror ZFS sui 2 SSD (checksum, compressione, snapshot).
VM Debian 12 "prod" per i siti; container LXC per servizi accessori; VM sandbox usa-e-getta.
Motivo: isolamento progetti, snapshot pre-esperimento, disaster recovery = reinstalla+ripristina.

## 2026-07 — Backup fuori dal server
Canale principale: WireGuard verso casa (idealmente Proxmox Backup Server in VM locale,
incrementali dedupllicati). Opzionale: copia cifrata su object storage per il caso estremo.
I backup sulla stessa macchina non sono backup.

## 2026-07 — DNS e cache: Cloudflare free tier
Gestione DNS via API (comodo con più domini), cache davanti ai siti statici, IP origin
schermato. La protezione DDoS SeFlow inclusa copre già la difesa di base.

## 2026-07 — Economia della pipeline
Claude Code interattivo (costruzione) rientra nell'abbonamento Max; l'esecuzione
programmatica via Agent SDK consuma il credito SDK mensile del piano, poi pay-as-you-go.
Conseguenza di design: pre-filtering locale, poche chiamate ben strutturate, costo/articolo
misurato e loggato. (Rif. policy giugno 2026.)

## 2026-07 — Roster siti e ordine di rollout
Sei domini: tabletnexus.com (pilota), freegamersworld.com, roboticfoundry.com,
fasterthanspace.com (news); buildyournas.com (guide+news, stesso tema con più peso su
contenuti evergreen e componenti tecnici); playbox75.com (giochi HTML5 giocabili on-site).
Pilota = tabletnexus perché è il caso "news classico" che valida tema+pipeline; secondo =
freegamersworld perché ha fonti API strutturate e valida il riuso di _shared.
playbox75 è deliberatamente ULTIMO e fuori dal modello news: richiede modello contenuti
proprio (schede gioco + embed iframe) e verifica delle licenze di embedding dei giochi
(usare cataloghi publisher autorizzati o giochi open source; mai embed non autorizzati).

## 2026-07 — Monorepo con npm workspaces
Root `package.json` con `workspaces` che elenca esplicitamente solo le cartelle con un
proprio `package.json` (ora `sites/_shared` e `sites/tabletnexus`); NON usare il glob
`sites/*` finché gli altri siti sono solo `.gitkeep`, perché npm fallirebbe su cartelle
senza package. Il tema condiviso è il pacchetto `@newsforge/shared`. Aggiungere i siti
successivi = aggiungere una riga ai workspaces. Scartato: siti standalone con import
relativi (da rifattorizzare a ogni nuovo sito).

## 2026-07 — Tailwind v4 via plugin Vite
`@tailwindcss/vite` + `@tailwindcss/typography`, config CSS-first (`@import "tailwindcss"`
in `global.css`), niente `tailwind.config.js`. Scartato `@astrojs/tailwind`+v3 (approccio
legacy). Rivalutare solo se un plugin necessario non fosse compatibile con v4.

## 2026-07 — Schema frontmatter in _shared, collection nel sito
Lo schema Zod (`newsSchema`) è la fonte di verità in `sites/_shared/src/content/config.ts`
e usa `astro/zod` (non `astro:content`, che è un modulo virtuale non importabile fuori da
un progetto Astro). Ogni sito importa lo schema via alias `@shared` e definisce la propria
collection in `src/content.config.ts`, perché Astro esige che la definizione stia dentro il
progetto. `image` è opzionale ma richiede `imageAlt` (superRefine).

## 2026-07 — Fixtures come sorgente della collection in fase tema
In sviluppo del tema la collection `news` carica i `.md/.mdx` da `sites/_shared/fixtures/`
via glob loader (`base: "../_shared/fixtures"`), così la cartella `src/content/news/` del
sito resta intatta a mano (regola CLAUDE.md) fino a quando la pipeline vi scriverà articoli
reali. Vite `server.fs.allow` include la root del monorepo per leggere fuori dal progetto.
In dev NON si filtrano le bozze (le fixtures sono tutte `draft: true`); il filtro
draft→publish arriverà con la pipeline.

## 2026-07 — Design system tutto in _shared, siti sottili
Layout, componenti e componenti MDX vivono in `sites/_shared/src` e i siti li importano via
alias `@shared/*`. Un sito è "sottile": `config/site.ts` (branding), pagine che passano il
config ai layout condivisi, `content.config.ts`. `ArticleLayout` fa esso stesso il `render()`
del post e passa i componenti MDX a `<Content>`, così le pagine dei siti restano di poche
righe. Scartato: duplicare layout/CSS in ogni sito (violerebbe la regola "il 90% vive in
_shared" e moltiplicherebbe la manutenzione).

## 2026-07 — Theming per-sito via CSS variables
L'accento brand di ogni sito è una CSS var (`--brand` / `--brand-dark`) iniettata da
`BaseLayout` sull'elemento `<html>` a partire da `site.brand`; `global.css` mappa le utility
Tailwind `*-brand` / `*-brand-dark` su quelle var (`@theme { --color-brand: var(--brand) }`).
Così i componenti condivisi non conoscono i colori dei singoli siti e un nuovo sito cambia
palette modificando solo il suo `config/site.ts`. Scartato: un `tailwind.config` per sito o
classi hardcoded per brand.

## 2026-07 — Componenti MDX passati via prop `components`
`SchedaTecnica`, `ProsCons`, `TabellaPrezzi` sono raccolti in `mdxComponents` (barrel) e
passati a `<Content components={mdxComponents} />` in `ArticleLayout`. Conseguenza: gli
articoli MDX prodotti dalla pipeline li usano come tag (`<ProsCons .../>`) senza righe di
`import`, riducendo la superficie di errore dell'agente. I componenti usano `not-prose` per
sfuggire agli stili tipografici del corpo.

## 2026-07 — Ricerca: Pagefind Default UI, indice solo sugli articoli
La ricerca usa la Default UI di Pagefind (`/pagefind/pagefind-ui.js` + css) generata dal CLI
in `dist/pagefind/` durante `npm run build` (`astro build && pagefind --site dist`). Solo il
corpo articolo ha `data-pagefind-body` (in `ArticleLayout`): così Pagefind indicizza gli
articoli e ignora home/categorie/nav. La ricerca funziona sotto `astro build && preview` e in
produzione, NON in `astro dev` (gli asset non esistono ancora: la pagina `/cerca` resta vuota,
senza errori). Pagefind 1.5 suggerisce la nuova Component UI: rivalutabile in futuro, la
Default UI basta ora.

## 2026-07 — RSS/sitemap/SEO
RSS: endpoint `src/pages/rss.xml.ts` per sito con `@astrojs/rss`, alimentato da
`getVisibleNews()` (stessa sorgente di home e categorie, così restano coerenti). Sitemap:
integrazione `@astrojs/sitemap` (richiede `site` in config, già presente) → `sitemap-index.xml`
al build. SEO: `BaseLayout` emette canonical, Open Graph e Twitter card; `ArticleLayout` passa
`og:image` assoluto (`new URL(image, Astro.site)`, gestisce sia URL remoti sia path locali) e
`og:type=article`. Autodiscovery RSS via `<link rel="alternate">` nell'head.

## 2026-07 — Pipeline provider-agnostica (rettifica del "Claude Agent SDK")
I doc dicevano "Claude Agent SDK", ma i due nomi indicano prodotti diversi: il **Claude Agent
SDK** (`@anthropic-ai/claude-agent-sdk`) è Claude Code come libreria (agent loop, filesystem,
bash) — sovradimensionato per generare un articolo. Decisione: **nessun lock-in su un SDK**.
Interfaccia neutra `LLMProvider` con adapter intercambiabili (Claude, in futuro OpenAI o LLM
locale). Motivo (richiesta esplicita): poter cambiare modello/fornitore al bisogno. Primo
backend: Anthropic via `@anthropic-ai/sdk` (Messages API), modello **Sonnet 5** (qualità vicina
a Opus su questo task, costo/articolo molto minore; la pipeline gira su credito a consumo).
Scartato: legarsi all'Agent SDK o a un unico vendor.

## 2026-07 — Ricerca locale, il modello fa solo sintesi
Corollario del punto sopra: la ricerca/fetch delle fonti è compito della **pipeline** (fetch +
estrazione testo con cheerio in `research/fetch.ts`), non un tool proprietario del modello
(es. `web_search` di Claude). Così: (a) funziona con qualunque backend, anche un LLM locale
senza web search; (b) rispetta il vincolo economico di `pipeline/CLAUDE.md` (passare al modello
solo testo utile, una singola chiamata strutturata). Il modello riceve il materiale già
ripulito e produce l'articolo strutturato, validato con Zod (schema che rispecchia il
frontmatter condiviso). Output sempre `draft: true`.

## 2026-07 — Provider `mock` per test offline
Oltre all'adapter Anthropic esiste un provider `mock` che restituisce una bozza deterministica
senza chiamare alcun modello. Permette di verificare l'intera catena (fetch → sintesi →
validazione → scrittura → render Astro) senza `ANTHROPIC_API_KEY` né costi, e serve da modalità
di sviluppo offline. La collection del sito in fase tema legge ancora dalle fixtures: la
generazione scrive in `src/content/news/`, ma il passaggio a leggere gli articoli reali
(draft→publish) è deciso in Fase 6.

## 2026-07 — Contenuti reali + visibilità bozze (Fase 6)
Le `_shared/fixtures/` (fase 2-4, sviluppo tema) sono state **migrate** negli articoli reali
del sito in `sites/tabletnexus/src/content/news/` e la collection ora legge quella cartella.
La visibilità è centralizzata in `getVisibleNews()` (`_shared/lib/news.ts`): le bozze
(`draft: true`) sono **mostrate in dev** (anteprima per il revisore) e **nascoste in
produzione** via `import.meta.env.PROD`. Anche `getStaticPaths` della route articolo usa
`getVisibleNews`, così in produzione le bozze non generano pagine né entrano in sitemap/RSS.
Scartato: filtro bozze duplicato nelle singole pagine (drift garantito).

## 2026-07 — Dedup idempotente (Fase 6)
`pipeline/state/<sito>.json` (gitignored) registra gli articoli già coperti (slug + URL fonti
normalizzati). `generate` fa un pre-check prima di chiamare il modello (skip se le fonti sono
già coperte → zero token sprecati) e un post-check sullo slug prima di scrivere. `--force`
bypassa. Motivo: rendere le run ripetibili/schedulabili senza duplicati. Il timer systemd vero
è fase 7 (infra); qui si costruisce solo la base idempotente.

## 2026-07 — Multilingua: default inglese + i18n (ribalta "contenuti in italiano")
Il `CLAUDE.md` diceva "contenuti dei siti in italiano". Decisione ribaltata: i siti puntano al
**massimo pubblico**, quindi lingua **canonica inglese** + localizzazione. Set iniziale
conservativo: **en, it** (si aggiungono altre lingue dopo). Scelte:
- **URL simmetriche col prefisso lingua** (`/en/…`, `/it/…`); la radice `/` reindirizza a `/en/`.
  Segmenti di path in inglese (`news`, `category`, `about`, `search`); si localizzano contenuti
  ed etichette, non i segmenti.
- **Contenuto per-lingua**: `src/content/news/<lang>/<slug>.md`; lo slug è condiviso tra lingue
  = chiave di traduzione. Un evento → un canonico (EN) + N traduzioni (non eventi separati; il
  dedup v3 resta a livello di evento, il modello di embedding è multilingue).
- **Categorie come chiavi neutre** (`news`, `comparisons`, …) con etichette localizzate nel
  config del sito. Stringhe UI in `_shared/src/i18n/` (dizionario + `useTranslations`).
- **Selettore lingua** che resta nella sezione (articolo EN → stesso slug IT), `hreflang`
  (en/it/x-default), **RSS per lingua**, `getVisibleNews(lang)`.
- **Pipeline**: genera il canonico EN → passo di traduzione verso le altre lingue (fase B).
Lingue non-latine (cinese/giapponese) e RTL (arabo) rimandate: il limite non è la capacità
dell'LLM ma la **verificabilità** (non poter rileggere) e la complessità di layout.
Scelta lingue iniziali motivata dalle più parlate a scrittura latina, verificabili e senza RTL.

## 2026-07 — Dedup semantico con embedding locali (Pipeline v3)
Il dedup della fase 6 (URL + slug esatti) è ingenuo: non riconosce la stessa notizia da fonti
diverse né la ripresa in ritardo. La v3 aggiunge una **cascata**: (1) URL esatto → scarta;
(2) similarità semantica sugli **embedding** della "firma evento" (titolo + lead) contro
l'indice del già-coperto → `score ≥ 0.86` doppione, `< 0.72` nuova; (3) fascia grigia →
**giudice LLM** ("stesso evento specifico? non basta lo stesso prodotto"). Se il giudice non
c'è (es. provider `mock`), la fascia grigia è **conservativa = doppione**. Gli embedding sono
**locali** (transformers.js, modello `paraphrase-multilingual-MiniLM-L12-v2` su CPU, costo zero,
offline) — coerente con l'astrazione provider e la filosofia locale. `state/` diventa un indice
semantico (embedding + titolo + summary per voce); confronto in memoria, niente DB vettoriale a
questa scala. Bonus: gli stessi embedding **clusterizzano** candidate multi-fonte → un articolo
con più fonti (migliora anche la qualità). Soglie iniziali 0.86/0.72, da tarare sui casi reali.
Limite noto: distinguere "stesso prodotto, evento diverso" dipende dal giudice.

## 2026-07 — Coda di revisione draft→publish (Fase 6)
Comandi pipeline `review` (elenca articoli con stato pubblicato/bozza) e `publish` (porta
`draft: true`→`false` con una sostituzione chirurgica sulla riga del frontmatter, `--slug` o
`--all`). La pubblicazione resta una **decisione umana esplicita**: la pipeline non pubblica
mai da sola. Scartato: pubblicazione automatica o spostamento file tra cartelle (il flag nel
frontmatter è più semplice e reversibile).
