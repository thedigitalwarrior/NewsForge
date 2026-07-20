import type { SiteDefinition } from "../sites.js";
import type { SourceDoc } from "../providers/types.js";

/**
 * Editorial system prompt for a short news article. Encodes the content rules
 * from the root CLAUDE.md (original synthesis, cited sources, no clickbait).
 */
export function newsBriefSystem(site: SiteDefinition): string {
  return [
    `Sei un redattore di ${site.name}, un sito di news in italiano. Scrivi articoli brevi, accurati e originali.`,
    "",
    "Regole di contenuto (inderogabili):",
    "- Sintesi ORIGINALE: mai copiare né parafrasare da vicino le fonti. Rielabora con parole tue.",
    "- Verifica i fatti su più fonti quando possibile; non affermare nulla che le fonti non supportino.",
    "- Cita SEMPRE gli URL delle fonti effettivamente usate nel campo `sources`.",
    "- Tono informativo, asciutto, zero clickbait. Niente superlativi gratuiti.",
    "- Resta concentrato sul soggetto dell'articolo: non divagare su prodotti o annunci collaterali, salvo un brevissimo cenno solo se davvero rilevante.",
    "- Lunghezza tipica: 300–600 parole.",
    "- Il campo `body` è Markdown in italiano: usa sottotitoli `##`, NIENTE titolo H1 e NIENTE frontmatter.",
    `- Il campo \`category\` deve essere esattamente una tra: ${site.categories.join(", ")}.`,
    "",
    "Restituisci l'articolo nel formato strutturato richiesto.",
  ].join("\n");
}

/** Build the user turn: the task plus any fetched source material. */
export function buildInstructions(args: {
  topic?: string;
  sources: SourceDoc[];
  site: SiteDefinition;
}): string {
  const { topic, sources, site } = args;
  const parts: string[] = [];

  parts.push(
    topic
      ? `Scrivi un articolo di news su: ${topic}.`
      : `Scrivi un breve articolo di news di attualità pertinente per ${site.name} (tema: tablet).`,
  );

  if (sources.length) {
    parts.push(
      "",
      "Materiale dalle fonti qui sotto: usalo come base fattuale, sintetizza con parole tue e cita i rispettivi URL in `sources`.",
    );
    sources.forEach((s, i) => {
      parts.push("", `[Fonte ${i + 1}] ${s.title}`, `URL: ${s.url}`, s.text);
    });
  } else {
    parts.push(
      "",
      "Non sono state fornite fonti recuperate automaticamente. Basati solo su fatti che conosci con certezza e che potresti citare; se non hai fonti verificabili, dichiaralo nel testo.",
      `Domini autorevoli di riferimento per questo sito: ${site.defaultSourceHints.join(", ")}.`,
    );
  }

  return parts.join("\n");
}
