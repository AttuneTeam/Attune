import { z } from "zod"

/**
 * The brain dump's contract with the model.
 *
 * AI output is untrusted input that happens to look plausible, and
 * product-guidelines.md holds it to a higher bar than UI chrome: extract only
 * what is real, and when in doubt return less. A confident hallucination costs
 * more trust than an empty result.
 */

/**
 * A dump of everything in a manager's head is long, but a proposal of hundreds
 * of checkboxes is not something anyone reviews — it is something they rubber
 * stamp. Capping it keeps the accept step meaningful.
 */
export const MAX_SUGGESTIONS = 60

export const areaSuggestionsSchema = z.object({
  areas: z
    .array(
      z
        .object({
          title: z.string().trim().min(1).max(200),
          /** An existing domain name, a new one, or null for ungrouped. */
          domain: z.string().trim().max(80).nullable(),
        })
        // Strict: the model proposes areas and nothing else. Confidence is the
        // manager's judgement to make, and an owner is a real person's name —
        // a hallucinated one would be worse than useless.
        .strict(),
    )
    .max(MAX_SUGGESTIONS),
})

export type AreaSuggestions = z.infer<typeof areaSuggestionsSchema>
export type AreaSuggestion = AreaSuggestions["areas"][number]

/**
 * Builds the user-side prompt.
 *
 * The manager's existing domains are offered explicitly. Without them the model
 * coins "Tech" alongside their "Platform" and the map fragments on the very
 * first dump.
 */
export function buildAreaSuggestionPrompt(
  text: string,
  existingDomains: readonly string[],
): string {
  const domains =
    existingDomains.length > 0
      ? `The manager already uses these domains, and you should reuse them wherever one fits:\n${existingDomains
          .map((d) => `- ${d}`)
          .join("\n")}`
      : "The manager has no domains yet, so propose sensible ones."

  return `${domains}\n\nHere is what the manager wrote:\n\n${text}`
}
