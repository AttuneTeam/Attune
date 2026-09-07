import {
  CONFIDENCE_ORDER,
  compareByConfidence,
  confidenceRank,
  summariseCoverage,
  type CoverageInput,
} from "./coverage"
import type { AreaConfidence } from "@/lib/supabase/types"

/**
 * The per-domain summary answers the question the map exists for: where am I
 * thin? A count alone cannot say that — twelve areas all marked `unknown` and
 * twelve all marked `owned` are the same number and opposite situations.
 */

const NOW = new Date("2026-09-07T12:00:00.000Z")

function daysBefore(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function input(
  confidence: AreaConfidence,
  overrides: Partial<CoverageInput> = {},
): CoverageInput {
  return {
    confidence,
    created_at: daysBefore(1),
    last_reviewed_at: daysBefore(1),
    owner_id: "member-1",
    ...overrides,
  }
}

describe("CONFIDENCE_ORDER", () => {
  it("runs from least held to most held", () => {
    // The direction is load-bearing: rank 0 is the thin end, so a low average
    // means a thin domain rather than a well-covered one.
    expect(CONFIDENCE_ORDER).toEqual(["unknown", "aware", "understood", "owned"])
  })
})

describe("confidenceRank", () => {
  it("ranks each level by how well the area is held", () => {
    expect(confidenceRank("unknown")).toBe(0)
    expect(confidenceRank("aware")).toBe(1)
    expect(confidenceRank("understood")).toBe(2)
    expect(confidenceRank("owned")).toBe(3)
  })
})

describe("compareByConfidence", () => {
  it("orders the least understood first", () => {
    // Available for an explicit sort, but not the default view: FR3 keeps the
    // whole surface visible in its own order rather than reordering by
    // confidence behind the manager's back.
    const sorted = (["owned", "unknown", "understood", "aware"] as AreaConfidence[])
      .map((c) => input(c))
      .sort(compareByConfidence)
      .map((a) => a.confidence)
    expect(sorted).toEqual(["unknown", "aware", "understood", "owned"])
  })

  it("is stable for equal confidence", () => {
    expect(compareByConfidence(input("aware"), input("aware"))).toBe(0)
  })
})

describe("summariseCoverage", () => {
  it("counts a mixed domain across every level", () => {
    const summary = summariseCoverage(
      [
        input("unknown"),
        input("unknown"),
        input("aware"),
        input("understood"),
        input("owned"),
      ],
      NOW,
    )
    expect(summary.total).toBe(5)
    expect(summary.counts).toEqual({ unknown: 2, aware: 1, understood: 1, owned: 1 })
  })

  it("reports zero for levels that are absent", () => {
    // Every level is always present as a key so the renderer never has to guard
    // for undefined while drawing a fixed four-slot indicator.
    const summary = summariseCoverage([input("owned")], NOW)
    expect(summary.counts).toEqual({ unknown: 0, aware: 0, understood: 0, owned: 1 })
  })

  it("counts how many areas in the domain want attention", () => {
    // FR6: the group carries one count so the rows stay calm. Two coral marks
    // on a screen is usually one too many.
    const summary = summariseCoverage(
      [
        input("aware"),
        input("aware", { last_reviewed_at: daysBefore(40) }),
        input("owned", { owner_id: null }),
      ],
      NOW,
    )
    expect(summary.total).toBe(3)
    expect(summary.attention).toBe(2)
  })

  it("counts an area needing attention for both reasons only once", () => {
    const summary = summariseCoverage(
      [input("unknown", { last_reviewed_at: daysBefore(40), owner_id: null })],
      NOW,
    )
    expect(summary.attention).toBe(1)
  })

  it("scores a fully owned domain at 1 and a wholly unknown one at 0", () => {
    expect(summariseCoverage([input("owned"), input("owned")], NOW).score).toBe(1)
    expect(summariseCoverage([input("unknown"), input("unknown")], NOW).score).toBe(0)
  })

  it("scores a mixed domain between the two", () => {
    // aware (1) and understood (2) average to 1.5 of a possible 3.
    expect(summariseCoverage([input("aware"), input("understood")], NOW).score).toBeCloseTo(
      0.5,
    )
  })

  it("handles a single area", () => {
    const summary = summariseCoverage([input("aware")], NOW)
    expect(summary.total).toBe(1)
    expect(summary.counts.aware).toBe(1)
    expect(summary.score).toBeCloseTo(1 / 3)
    expect(summary.attention).toBe(0)
  })

  it("handles an empty domain without dividing by zero", () => {
    // A domain the manager created but has not filled yet. score is null rather
    // than 0: an empty domain is not a wholly unknown one, and rendering it as
    // four empty dots would overstate the problem.
    const summary = summariseCoverage([], NOW)
    expect(summary.total).toBe(0)
    expect(summary.attention).toBe(0)
    expect(summary.score).toBeNull()
    expect(summary.counts).toEqual({ unknown: 0, aware: 0, understood: 0, owned: 0 })
  })
})
