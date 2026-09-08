/**
 * What the manager is told after accepting a brain dump.
 *
 * Extracted from the component because the first version silently lied: when a
 * domain failed to create, its areas were filed as ungrouped and the message
 * still read "Added 6 areas". Someone accepted a grouped proposal and received
 * a flat one with no mention of it.
 *
 * Reporting partial success honestly is exactly the kind of branchy string
 * that rots unnoticed inside JSX, so it lives here with tests.
 */

export type AcceptOutcome = {
  added: number
  /** Areas the server refused. */
  failed: number
  /** Domains that could not be created — their areas end up ungrouped. */
  failedDomains: readonly string[]
}

export function summariseAcceptOutcome(outcome: AcceptOutcome): {
  ok: boolean
  message: string
} {
  const { added, failed, failedDomains } = outcome
  const parts = [`Added ${added} ${added === 1 ? "area" : "areas"}`]

  if (failed > 0) parts.push(`${failed} could not be saved`)

  if (failedDomains.length > 0) {
    parts.push(
      `${failedDomains.join(" and ")} could not be created, so ${
        failedDomains.length === 1 ? "its areas are" : "those areas are"
      } ungrouped`,
    )
  }

  return {
    ok: failed === 0 && failedDomains.length === 0,
    message: `${parts.join(", ")}.`,
  }
}
