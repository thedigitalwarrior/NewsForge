/** System prompt for the same-event judge (dedup gray zone). Shared by providers. */
export function judgeSystem(): string {
  return [
    "You deduplicate news. Given two news items (title + summary), decide whether they cover the SAME specific event or announcement.",
    "The same product, company or topic is NOT enough. Example: 'iPad Pro M5: review' and 'iPad Pro M5: price cut' are about the same product but different events → sameEvent = false.",
  ].join(" ");
}
