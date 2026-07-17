import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { generate } from "./generate.js";
import { publish, review } from "./publish.js";

// Load pipeline/.env if present (for ANTHROPIC_API_KEY). Mock provider needs none.
try {
  if (existsSync(".env") && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(".env");
  }
} catch {
  // env can also come from the real environment
}

const USAGE = `Uso: <comando> [opzioni]

Comandi:
  generate   Genera un articolo (draft) da fonti
  review     Elenca lo stato degli articoli (coda di revisione)
  publish    Pubblica una bozza (draft: true -> false)

generate:
  --site <slug>       Sito di destinazione (es. tabletnexus)     [obbligatorio]
  --provider <nome>   anthropic | mock                            [default: anthropic]
  --topic "<testo>"   Argomento dell'articolo
  --url <fonte>       URL di una fonte da recuperare (ripetibile)
  --force             Rigenera anche se le fonti/slug sono già coperte
  --dry-run           Mostra l'articolo senza scrivere né aggiornare lo stato

review:
  --site <slug>       Sito da ispezionare                         [obbligatorio]

publish:
  --site <slug>       Sito                                        [obbligatorio]
  --slug <slug>       Bozza da pubblicare
  --all               Pubblica tutte le bozze`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      site: { type: "string" },
      provider: { type: "string", default: "anthropic" },
      topic: { type: "string" },
      url: { type: "string", multiple: true, default: [] },
      slug: { type: "string" },
      all: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const command = positionals[0] ?? "generate";

  if (!values.site) {
    console.error(USAGE);
    process.exit(1);
  }

  switch (command) {
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
