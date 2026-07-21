/**
 * The compact "event signature" we embed for dedup — NOT the full article (whose
 * wording varies too much). Title + a short lead captures the underlying event.
 */
export interface EventSignature {
  title: string;
  summary: string;
  /** The text actually embedded. */
  text: string;
}

const LEAD_CHARS = 300;

export function buildSignature(title: string, body: string): EventSignature {
  const cleanTitle = title.replace(/\s+/g, " ").trim();
  const summary = body.replace(/\s+/g, " ").trim().slice(0, LEAD_CHARS);
  return { title: cleanTitle, summary, text: `${cleanTitle}. ${summary}` };
}
