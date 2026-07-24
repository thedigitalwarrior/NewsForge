import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { generate } from "./generate.js";
import { discover } from "./discover.js";
import { publish, review } from "./publish.js";

// Load pipeline/.env if present (ANTHROPIC_API_KEY, BRAVE_API_KEY).
try {
  if (existsSync(".env") && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(".env");
  }
} catch {
  // env can also come from the real environment
}

const USAGE = `Uso: <comando> [opzioni]

Comandi:
  discover   Cerca notizie, raggruppa per evento e genera i nuovi articoli
  generate   Genera un articolo (draft) da fonti indicate a mano
  review     Elenca lo stato degli articoli (coda di revisione)
  publish    Pubblica una bozza (draft: true -> false, tutte le lingue)

discover:
  --site <slug>          Sito                                   [obbligatorio]
  --provider <nome>      LLM: anthropic | mock                   [default: anthropic]
  --search <nome>        Motore di ricerca: brave                [default: brave]
  --max-queries <n>      Quante query eseguire                   [default: 4]
  --per-query <n>        Risultati per query                     [default: 20]
  --max-articles <n>     Massimo articoli generati per run       [default: 2]
  --freshness <pd|pw|pm> Finestra temporale                      [default: pd]
  --dry-run              Mostra eventi e fonti senza generare

generate:
  --site <slug>       Sito                                       [obbligatorio]
  --provider <nome>   anthropic | mock                            [default: anthropic]
  --topic "<testo>"   Argomento dell'articolo
  --url <fonte>       URL di una fonte (ripetibile)
  --force             Rigenera anche se già coperto
  --dry-run           Mostra l'articolo senza scrivere

review / publish:
  --site <slug>       Sito                                       [obbligatorio]
  --slug <slug>       (publish) Bozza da pubblicare
  --all               (publish) Pubblica tutte le bozze`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      site: { type: "string" },
      provider: { type: "string", default: "anthropic" },
      search: { type: "string", default: "brave" },
      topic: { type: "string" },
      url: { type: "string", multiple: true, default: [] },
      slug: { type: "string" },
      all: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      "max-queries": { type: "string", default: "4" },
      "per-query": { type: "string", default: "20" },
      "max-articles": { type: "string", default: "2" },
      freshness: { type: "string", default: "pd" },
    },
  });

  const command = positionals[0] ?? "generate";

  if (!values.site) {
    console.error(USAGE);
    process.exit(1);
  }

  switch (command) {
    case "discover":
      await discover({
        site: values.site,
        provider: values.provider ?? "anthropic",
        searchProvider: values.search ?? "brave",
        maxQueries: Number(values["max-queries"]),
        perQuery: Number(values["per-query"]),
        maxArticles: Number(values["max-articles"]),
        freshness: values.freshness ?? "pd",
        dryRun: values["dry-run"] ?? false,
      });
      break;
    case "generate":
      await generate({
        site: values.site,
        provider: values.provider ?? "anthropic",
        topic: values.topic,
        urls: (values.url as string[]) ?? [],
        dryRun: values["dry-run"] ?? false,
        force: values.force ?? false,
      });
      break;
    case "review":
      await review(values.site);
      break;
    case "publish":
      await publish(values.site, { slug: values.slug, all: values.all });
      break;
    default:
      console.error(`Comando sconosciuto: "${command}".\n\n${USAGE}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`✗  ${(err as Error).message}`);
  process.exit(1);
});
