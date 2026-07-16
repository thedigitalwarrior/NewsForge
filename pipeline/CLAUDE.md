# Pipeline — generazione contenuti con Claude Agent SDK

## Ruolo

Questa cartella contiene l'"operaio" del sistema: script TypeScript basati su Claude Agent SDK
che, dato un sito e le sue fonti, producono articoli Markdown/MDX conformi allo schema
frontmatter e li salvano in `sites/<sito>/src/content/news/` con `draft: true`.

## Vincolo economico (tenerlo presente nel design)

L'uso programmatico dell'Agent SDK NON rientra nei limiti flat dell'abbonamento Max:
consuma il credito SDK mensile del piano e poi eventuale pay-as-you-go. Quindi:

- Minimizzare i token: passare al modello solo il testo utile (niente HTML grezzo delle
  pagine fonte — estrarre prima il contenuto con parsing locale).
- Fare pre-filtering locale (dedup, rilevanza) PRIMA di chiamare il modello.
- Un articolo = idealmente una singola chiamata ben strutturata, non una conversazione lunga.
- Loggare token usati per run (il costo per articolo è una metrica di prima classe).
- `--dry-run` non deve chiamare il modello più del necessario.

## Architettura (v1)

**Provider-agnostica.** Il codice non dipende da un SDK LLM specifico: c'è un'interfaccia
`LLMProvider` (`src/providers/types.ts`) e adapter concreti. Oggi: `anthropic` (Claude via
`@anthropic-ai/sdk`, Sonnet 5) e `mock` (offline, per test senza chiave né costi). OpenAI o un
LLM locale = un nuovo file che implementa l'interfaccia + una riga in `src/providers/index.ts`.

**La ricerca è locale, non del modello.** La pipeline recupera le fonti (`--url`), estrae il
testo con `src/research/fetch.ts` (fetch + cheerio) e passa solo il materiale utile al modello,
che fa solo **sintesi** verso un output strutturato (validato con Zod). Così funziona con
qualunque backend — anche un LLM locale senza web search — e rispetta il vincolo economico.

## Struttura

- `src/providers/` — interfaccia `LLMProvider` + adapter (`anthropic`, `mock`) + registry.
- `src/research/fetch.ts` — fetch + estrazione testo delle fonti (locale, agnostica).
- `src/prompts/` — prompt editoriali versionati (v1: `news-brief`). Incorporano i vincoli di
  contenuto del CLAUDE.md di root (no copia, fonti citate, no clickbait, lunghezza).
- `src/article.ts` — schema Zod dell'output (rispecchia il frontmatter condiviso) + `body`.
- `src/sites.ts` — siti target: categorie (in sync col config del sito) e hint di dominio.
- `src/generate.ts` / `src/index.ts` — orchestrazione e CLI (`--site --provider --topic --url --dry-run`).
- `state/` (gitignored) — registro dedup (hash/URL). **Fase 6**, non ancora presente.

## Flusso di un run

1. Fetch fonti → normalizzazione (titolo, testo, url, data)
2. Dedup contro `state/` e contro gli articoli già presenti nel sito
3. Selezione candidati (regole locali: novità, rilevanza per categoria)
4. Per ogni candidato: chiamata Agent SDK con prompt editoriale + materiale fonte
5. Validazione output: frontmatter contro lo schema Zod condiviso; se invalido, scarto e log
6. Scrittura file `.md`/`.mdx` con `draft: true` + aggiornamento `state/`

La build e il deploy NON sono compiti della pipeline: li orchestrano cron/systemd + hook
(vedi `infra/`). La pipeline produce solo file di contenuto.

## Qualità editoriale

- Ogni articolo: fonti multiple quando possibile, link espliciti, date verificate.
- Tono: informativo, asciutto, zero clickbait. Niente affermazioni non supportate dalle fonti.
- Lunghezza tipica: 300–600 parole per news; le liste/guide possono essere più lunghe.
- Usare i componenti MDX condivisi quando il tipo di articolo lo prevede
  (es. `<ProsCons>`, `<SchedaTecnica>`).
