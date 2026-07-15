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
