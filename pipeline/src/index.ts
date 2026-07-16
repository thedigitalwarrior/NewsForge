import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { generate } from "./generate.js";

// Load pipeline/.env if present (for ANTHROPIC_API_KEY). Mock provider needs none.
try {
  if (existsSync(".env") && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(".env");
  }
} catch {
  // ignore — env can also come from the real environment
}

const USAGE = `Uso:
  npm run generate -- --site <slug> [opzioni]

Opzioni:
  --site <slug>       Sito di destinazione (es. tabletnexus)   [obbligatorio]
  --provider <nome>   anthropic | mock                          [default: anthropic]
  --topic "<testo>"   Argomento dell'articolo
  --url <fonte>       URL di una fonte da recuperare (ripetibile)
  --dry-run           Mostra l'articolo senza scrivere il file`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      site: { type: "string" },
      provider: { type: "string", default: "anthropic" },
      topic: { type: "string" },
      url: { type: "string", multiple: true, default: [] },
      "dry-run": { type: "boolean", default: false },
    },
  });

  if (!values.site) {
    console.error(USAGE);
    process.exit(1);
  }

  await generate({
    site: values.site,
    provider: values.provider ?? "anthropic",
    topic: values.topic,
    urls: (values.url as string[]) ?? [],
    dryRun: values["dry-run"] ?? false,
  });
}

main().catch((err) => {
  console.error(`✗  ${(err as Error).message}`);
  process.exit(1);
});
