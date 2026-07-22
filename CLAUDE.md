# NewsForge — Rete di siti di news automatizzati

## Cos'è questo progetto

Monorepo per una rete di siti tematici su domini di proprietà di Stefano. I contenuti sono
generati da una pipeline basata su Claude Agent SDK, i siti sono statici (Astro) e serviti
da Caddy su un server dedicato con Proxmox.

## I siti della rete

| Cartella | Dominio | Tipo | Note |
|---|---|---|---|
| `tabletnexus` | tabletnexus.com | News | Tablet: novità, confronti, prezzi. **Sito pilota** (fasi 2-5). |
| `freegamersworld` | freegamersworld.com | News | Giochi rilasciati gratis (Epic/Steam/GOG/Prime). Fonti API-friendly. |
| `roboticfoundry` | roboticfoundry.com | News | Robotica: ricerca, prodotti, industria. |
| `fasterthanspace` | fasterthanspace.com | News | Spazio e astronomia: missioni, scoperte, lanci. |
| `buildyournas` | buildyournas.com | Guide + news | Costruire NAS da zero + schede/prezzi NAS commerciali. Più evergreen che news: guide lunghe, componenti MDX (SchedaTecnica, TabellaPrezzi) centrali. |
| `playbox75` | playbox75.com | **App: giochi giocabili on-site** | NON è un sito di news: catalogo di giochi HTML5 embeddati. Modello contenuti diverso (scheda gioco + iframe), pipeline diversa o assente. Trattarlo come progetto a sé nella fase dedicata; NON forzarlo nel template news. Vincolo legale: embeddare SOLO giochi da cataloghi che lo autorizzano (distributori con programmi publisher) o open source con licenza compatibile. Mai hotlinkare giochi senza autorizzazione. |

I quattro siti "News" condividono lo stesso modello: tema `_shared` + pipeline articoli.
`buildyournas` usa lo stesso tema con peso maggiore su guide e componenti tecnici.
`playbox75` condivide al massimo lo stile visivo, non il modello contenuti.

**Regola d'oro:** contenuto e presentazione sono separati. La pipeline produce solo
Markdown/MDX + frontmatter; l'aspetto è deciso interamente dal tema in `sites/_shared`.

## Struttura del repository

- `sites/_shared/` — tema comune: componenti Astro, layout, CSS/Tailwind, config base,
  componenti MDX (SchedaTecnica, ProsCons, TabellaPrezzi, ...). Il 90% di ogni sito vive qui.
- `sites/<dominio>/` — un sito per cartella (vedi tabella sopra): solo config specifica (colori, logo, categorie,
  fonti) + `src/content/news/` con gli articoli Markdown/MDX.
- `pipeline/` — script Agent SDK (TypeScript) che generano gli articoli. Vedi `pipeline/CLAUDE.md`.
- `infra/` — Ansible per provisioning e deploy (VM locale → server SeFlow). Vedi `infra/CLAUDE.md`.
- `docs/decisioni.md` — registro delle decisioni architetturali con motivazioni. **Consultarlo
  prima di proporre cambi di stack o riaprire discussioni già chiuse.**

## Stack tecnico (deciso, non riaprire senza motivo)

- **Siti:** Astro + Tailwind CSS (+ plugin typography), content collections con schema Zod,
  MDX per articoli ricchi. Zero JS client-side salvo isole esplicite.
- **Ricerca:** Pagefind, indicizzazione post-build. NON Meilisearch (rivalutare solo a
  migliaia di articoli/esigenze di ricerca istantanea).
- **Pipeline:** TypeScript, astrazione `LLMProvider` neutra (Claude/OpenAI/LLM locale);
  primo backend Anthropic via `@anthropic-ai/sdk` (Sonnet 5). La ricerca fonti è locale
  (fetch + estrazione), il modello fa solo sintesi strutturata. Gira via cron/systemd timer.
- **Web server:** Caddy (TLS automatico, un virtual host per dominio).
- **Hosting:** server dedicato SeFlow QA-2124.2 (Xeon E-2124, 64GB RAM, 2x480GB SSD),
  Proxmox VE su ZFS mirror (controller PERC in modalità HBA). Siti in una VM Debian 12
  dedicata ("prod"). DNS e cache: Cloudflare free tier.
- **Automazione:** Ansible per tutto il provisioning. Niente configurazioni a mano sui server.

## Comandi ricorrenti

```bash
# sviluppo sito (dalla cartella del sito)
npm run dev            # astro dev con hot reload
npm run build          # astro build + pagefind --site dist

# pipeline (da pipeline/)
npm run generate -- --site tabletnexus --provider mock --dry-run     # prova offline, senza chiave né costi
npm run generate -- --site tabletnexus --topic "..." --url <fonte>   # genera con Claude (default) da fonti reali
npm run generate -- --site tabletnexus                               # salva un draft in sites/tabletnexus/src/content/news/
npm run review   -- --site tabletnexus                               # coda di revisione: pubblicati vs bozze
npm run publish  -- --site tabletnexus --slug <slug>                 # pubblica una bozza (draft: true -> false); --all per tutte

# infra (da infra/)
ansible-playbook -i inventory/local.yml site.yml       # provisioning VM locale
ansible-playbook -i inventory/prod.yml site.yml        # provisioning produzione
```

(Aggiornare questa sezione man mano che gli script prendono forma.)

## Convenzioni

- **Lingua e i18n:** i siti sono **multilingua**. Lingua canonica/default: **inglese**;
  localizzazione in altre lingue (attuali: `en`, `it`). URL simmetriche col prefisso lingua
  (`/en/…`, `/it/…`). Il contenuto vive per-lingua in `src/content/news/<lang>/<slug>.md` (lo
  slug è condiviso = chiave di traduzione). Le categorie sono **chiavi neutre** (`news`,
  `comparisons`, …) con etichette localizzate nel config. Le stringhe UI stanno in
  `_shared/src/i18n/`. La pipeline genera il canonico in inglese e poi traduce.
  Codice, commenti e nomi restano in inglese.
- **TypeScript** ovunque (siti e pipeline), strict mode.
- **Frontmatter articoli** (schema in `sites/_shared/src/content/config.ts`):
  `title`, `description`, `pubDate`, `category`, `image`, `imageAlt`, `sources` (array di URL),
  `draft` (bool). La pipeline scrive SEMPRE `draft: true`; la pubblicazione è una decisione umana
  o un passaggio esplicito separato.
- **Niente hardcoding di ambiente:** IP, path, domini, email vivono nelle variabili Ansible
  (`infra/inventory/`) o in `.env` (mai committato).
- **Commit piccoli e frequenti**, messaggi in inglese, imperativi ("Add category badge").
- **Contenuti dei siti:** `sites/<dominio>/src/content/news/` contiene gli articoli reali
  (scritti dalla pipeline, poi pubblicati). Le bozze (`draft: true`) sono la coda di revisione:
  visibili in `astro dev` per l'anteprima, nascoste in produzione (`getVisibleNews` in
  `_shared`). La pubblicazione passa da `npm run publish` (o modifica esplicita del flag),
  mai un aggiornamento silenzioso. (Le vecchie `_shared/fixtures/` sono state ritirate in fase 6.)

## Vincoli di contenuto (IMPORTANTI, valgono anche per i prompt della pipeline)

- Mai copiare o parafrasare da vicino articoli altrui: sintesi originali, fatti verificati
  su più fonti, sempre con link alle fonti nel frontmatter e nel corpo.
- Immagini solo da fonti con licenza compatibile (stampa ufficiale, Unsplash/Pexels, proprie).
- Trasparenza: i siti dichiarano l'uso di AI nella pagina "chi siamo".

## Roadmap a fasi (una sessione = un obiettivo)

1. ✅ Sessione 0 — scaffold monorepo (questo)
2. ✅ Scaffold sito pilota (tabletnexus): Astro+Tailwind+collections+fixtures, `astro dev` ok
3. ✅ Design system in `_shared`: layout, homepage a griglia, pagina articolo, componenti MDX
4. ✅ Ricerca (Pagefind), RSS, sitemap, SEO base
5. ✅ Pipeline v1: un articolo generato da fonti reali, qualità iterata sui prompt
6. ✅ Pipeline v2: dedup notizie, coda di revisione (draft → publish). Scheduling (timer) → fase 7.
7. ⬜ Infra: playbook contro VM locale Debian 12, poi multi-sito
8. ⬜ Secondo sito news (freegamersworld): deve costare ore, non giorni
9. ⬜ Rollout siti news restanti (roboticfoundry, fasterthanspace) + buildyournas (variante guide)
10. ⬜ playbox75: progetto dedicato (catalogo giochi HTML5, licenze embed) — DOPO che la rete news è a regime
11. ⬜ Go-live su server SeFlow (può avvenire anche prima del punto 10, per i soli siti pronti)

## Fine sessione

Prima di chiudere una sessione di lavoro significativa: aggiornare la roadmap qui sopra,
registrare eventuali decisioni in `docs/decisioni.md`, committare.
