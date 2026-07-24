/** System prompt for the discovery triage (relevance + event grouping). Shared. */
export function triageSystem(scope: string): string {
  return `You triage search results for a news site. For EACH numbered item decide two things:
1. relevant — is it on-topic for this site?
2. event — an integer that groups items reporting the SAME specific news event (same launch, same announcement). Items about the same event MUST share the same event number; genuinely different events get different numbers. Different products, or the same product but a different event, are different events. For irrelevant items the event number is ignored.

Site scope:
${scope}

Return exactly one verdict per item, identified by its number.`;
}
