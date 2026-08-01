/** System prompt for the discovery triage (relevance + event grouping). Shared. */
export function triageSystem(scope: string): string {
  return `You triage search results for a news site. For EACH numbered item decide three things:
1. relevant — is it on-topic for this site?
2. event — an integer that groups items reporting the SAME specific news event (same launch, same announcement). Items about the same event MUST share the same event number; genuinely different events get different numbers. Different products, or the same product but a different event, are different events. For irrelevant items the event number is ignored.
3. importance — an integer 1–5 rating how newsworthy this is for the site's readers: 5 = a major story of wide interest, 3 = a solid but ordinary story, 1 = minor or niche. Judge the story itself, not how many outlets cover it. For irrelevant items importance is ignored.

Site scope:
${scope}

Return exactly one verdict per item, identified by its number.`;
}
