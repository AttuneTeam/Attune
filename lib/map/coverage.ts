import type { AreaConfidence, StrategicInitiative } from "@/lib/supabase/types"
import { needsAttention, type AttentionInput } from "./attention"

/**
 * Per-domain coverage for the Surface Area Map.
 *
 * A count on its own cannot answer the question the map exists for. Twelve
 * areas all marked `unknown` and twelve all marked `owned` are the same number
 * and opposite situations. The summary carries the distribution so a domain
 * heading can show, at a glance, whether the manager actually holds that
 * territory.
 */

/**
 * Least held to most held. The direction is load-bearing: rank 0 is the thin
 * end, so a low score means a thin domain rather than a well-covered one.
 */
export const CONFIDENCE_ORDER: readonly AreaConfidence[] = [
  "unknown",
  "aware",
  "understood",
  "owned",
] as const

export function confidenceRank(confidence: AreaConfidence): number {
  return CONFIDENCE_ORDER.indexOf(confidence)
}

/**
 * Orders the least understood first.
 *
 * Offered for an explicit sort, and deliberately not the default: FR3 keeps the
 * whole surface visible in its own order rather than reordering behind the
 * manager's back. The map's job is to show everything, not to rank it.
 */
export function compareByConfidence(
  a: Pick<StrategicInitiative, "confidence">,
  b: Pick<StrategicInitiative, "confidence">,
): number {
  return confidenceRank(a.confidence) - confidenceRank(b.confidence)
}

export type CoverageInput = AttentionInput & Pick<StrategicInitiative, "confidence">

export type CoverageSummary = {
  total: number
  /** Every level is always present, so a renderer never guards for undefined. */
  counts: Record<AreaConfidence, number>
  /** How many areas in the domain want attention — see attention.ts. */
  attention: number
  /**
   * Mean confidence normalised to 0–1, for the compact indicator beside a
   * domain heading. Null for an empty domain: a domain with nothing in it is
   * not a wholly unknown one, and drawing it as empty would overstate the
   * problem.
   */
  score: number | null
}

const MAX_RANK = CONFIDENCE_ORDER.length - 1

function emptyCounts(): Record<AreaConfidence, number> {
  return { unknown: 0, aware: 0, understood: 0, owned: 0 }
}

export function summariseCoverage(
  areas: readonly CoverageInput[],
  now: Date = new Date(),
): CoverageSummary {
  const counts = emptyCounts()
  let rankTotal = 0
  let attention = 0

  for (const area of areas) {
    counts[area.confidence] += 1
    rankTotal += confidenceRank(area.confidence)
    // Counted once per area, not once per reason: an area that is both stale
    // and unowned is still one thing to look at.
    if (needsAttention(area, now)) attention += 1
  }

  return {
    total: areas.length,
    counts,
    attention,
    score: areas.length === 0 ? null : rankTotal / (areas.length * MAX_RANK),
  }
}
