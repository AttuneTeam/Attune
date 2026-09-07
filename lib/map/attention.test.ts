import {
  STALENESS_THRESHOLD_DAYS,
  attentionReasons,
  daysSinceReview,
  formatReviewAge,
  isStale,
  needsAttention,
  type AttentionInput,
} from "./attention"

/**
 * The attention signal is the whole point of the Surface Area Map: a plain
 * outline that never changes colour tells the manager nothing they did not
 * already know. Exactly two conditions flag an area — staleness and the absence
 * of an owner (spec.md FR6).
 *
 * What is deliberately absent matters as much as what is present. Confidence
 * does NOT flag an area. A manager who honestly records that they do not yet
 * understand something must not be nagged for it, or they will stop recording
 * it honestly.
 */

const NOW = new Date("2026-09-07T12:00:00.000Z")

/** Builds an area whose last review sits a given number of days before NOW. */
function area(overrides: Partial<AttentionInput> = {}): AttentionInput {
  return {
    created_at: daysBefore(400),
    last_reviewed_at: daysBefore(0),
    owner_id: "member-1",
    owned_by_manager: false,
    ...overrides,
  }
}

function daysBefore(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe("STALENESS_THRESHOLD_DAYS", () => {
  it("is a single named constant so the review rhythm is one edit away", () => {
    // A manager's first quarter may not run on a three-week cycle. This being a
    // constant rather than a literal scattered through components is the point.
    expect(STALENESS_THRESHOLD_DAYS).toBe(21)
  })
})

describe("daysSinceReview", () => {
  it("counts whole days since the last review", () => {
    expect(daysSinceReview(area({ last_reviewed_at: daysBefore(14) }), NOW)).toBe(14)
  })

  it("floors a partial day rather than rounding up", () => {
    // Displayed as "13d" while it is still the fourteenth day. Rounding up would
    // show a day the manager has not yet lived through.
    const thirteenAndAHalf = new Date(
      NOW.getTime() - 13.5 * 24 * 60 * 60 * 1000,
    ).toISOString()
    expect(daysSinceReview(area({ last_reviewed_at: thirteenAndAHalf }), NOW)).toBe(13)
  })

  it("reports 0 for an area reviewed moments ago", () => {
    expect(daysSinceReview(area({ last_reviewed_at: daysBefore(0) }), NOW)).toBe(0)
  })

  it("falls back to created_at when the area has never been reviewed", () => {
    // A captured-and-forgotten area must age from the moment it was captured,
    // otherwise it would never surface at all.
    expect(
      daysSinceReview({ ...area(), last_reviewed_at: null, created_at: daysBefore(30) }, NOW),
    ).toBe(30)
  })
})

describe("isStale", () => {
  it("is not stale when reviewed today", () => {
    expect(isStale(area({ last_reviewed_at: daysBefore(0) }), NOW)).toBe(false)
  })

  it("is not stale the day before the threshold", () => {
    expect(isStale(area({ last_reviewed_at: daysBefore(20) }), NOW)).toBe(false)
  })

  it("is stale on reaching the threshold", () => {
    // The boundary is inclusive so the interface can say "not reviewed in 21
    // days" and mean it. An exclusive boundary would flag on day 22 while the
    // label read 21.
    expect(isStale(area({ last_reviewed_at: daysBefore(21) }), NOW)).toBe(true)
  })

  it("is stale well past the threshold", () => {
    expect(isStale(area({ last_reviewed_at: daysBefore(90) }), NOW)).toBe(true)
  })

  it("prefers last_reviewed_at over created_at", () => {
    // An area captured a year ago but reviewed yesterday is current. Reading
    // created_at first would flag every long-lived area permanently.
    expect(
      isStale({ created_at: daysBefore(400), last_reviewed_at: daysBefore(1), owner_id: "m", owned_by_manager: false }, NOW),
    ).toBe(false)
  })

  it("ages from created_at when never reviewed", () => {
    expect(
      isStale({ created_at: daysBefore(40), last_reviewed_at: null, owner_id: "m", owned_by_manager: false }, NOW),
    ).toBe(true)
  })

  it("does not flag a freshly captured area that has never been reviewed", () => {
    // Capture must not immediately produce a screen full of coral. An area
    // added this morning is not neglected.
    expect(
      isStale({ created_at: daysBefore(0), last_reviewed_at: null, owner_id: null, owned_by_manager: false }, NOW),
    ).toBe(false)
  })
})

describe("attentionReasons", () => {
  it("returns nothing for a current, owned area", () => {
    expect(attentionReasons(area(), NOW)).toEqual([])
  })

  it("reports staleness", () => {
    expect(attentionReasons(area({ last_reviewed_at: daysBefore(30) }), NOW)).toEqual([
      "stale",
    ])
  })

  it("reports an absent owner", () => {
    expect(attentionReasons(area({ owner_id: null }), NOW)).toEqual(["unowned"])
  })

  it("does NOT report an area the manager owns themselves as unowned", () => {
    // FR8. Many areas on a personal map are nobody else's. Without this,
    // "unowned" would mean both "mine" and "nobody's", and the column that
    // exists to answer "what should I delegate?" would answer nothing.
    expect(
      attentionReasons(area({ owner_id: null, owned_by_manager: true }), NOW),
    ).toEqual([])
    expect(
      needsAttention(area({ owner_id: null, owned_by_manager: true }), NOW),
    ).toBe(false)
  })

  it("still reports staleness on an area the manager owns", () => {
    // Owning something is not the same as having looked at it.
    expect(
      attentionReasons(
        area({ owner_id: null, owned_by_manager: true, last_reviewed_at: daysBefore(40) }),
        NOW,
      ),
    ).toEqual(["stale"])
  })

  it("reports both conditions together", () => {
    expect(
      attentionReasons(area({ last_reviewed_at: daysBefore(30), owner_id: null }), NOW),
    ).toEqual(["stale", "unowned"])
  })

  it("does NOT flag an area merely because its confidence is unknown", () => {
    // spec.md FR6, stated as a test so it cannot drift. A manager recording
    // "I do not understand this yet" is being honest, not negligent. Flagging
    // it would punish the honesty the map depends on.
    const honestlyUnknown = {
      ...area({ last_reviewed_at: daysBefore(1), owner_id: "member-1" }),
      confidence: "unknown" as const,
    }
    expect(attentionReasons(honestlyUnknown, NOW)).toEqual([])
    expect(needsAttention(honestlyUnknown, NOW)).toBe(false)
  })

  it("does NOT flag an area because an interaction signalled 'threatens'", () => {
    // Also FR6. Interaction signals are context on the area detail, never an
    // input to the attention mark. Encoded here so adding signals to the map
    // later is a deliberate decision rather than an accident.
    const threatened = { ...area(), signal: "threatens" as const }
    expect(attentionReasons(threatened, NOW)).toEqual([])
  })
})

describe("needsAttention", () => {
  it("is true when there is at least one reason", () => {
    expect(needsAttention(area({ owner_id: null }), NOW)).toBe(true)
  })

  it("is false when there are none", () => {
    expect(needsAttention(area(), NOW)).toBe(false)
  })

  it("defaults to the current time when none is supplied", () => {
    // The production call sites pass no clock; only the tests do.
    expect(needsAttention({ created_at: new Date().toISOString(), last_reviewed_at: null, owner_id: "m", owned_by_manager: false })).toBe(false)
  })
})

describe("formatReviewAge", () => {
  it("says so plainly when an area has never been reviewed", () => {
    // Showing "40d" for a never-reviewed area would imply it was reviewed 40
    // days ago. It was captured then and never looked at since, which is a
    // different and more useful thing to know.
    expect(
      formatReviewAge({ created_at: daysBefore(40), last_reviewed_at: null, owner_id: "m", owned_by_manager: false }, NOW),
    ).toBe("never reviewed")
  })

  it("uses words for the two most recent days", () => {
    expect(formatReviewAge(area({ last_reviewed_at: daysBefore(0) }), NOW)).toBe("today")
    expect(formatReviewAge(area({ last_reviewed_at: daysBefore(1) }), NOW)).toBe("yesterday")
  })

  it("counts days beyond that", () => {
    expect(formatReviewAge(area({ last_reviewed_at: daysBefore(2) }), NOW)).toBe("2d")
    expect(formatReviewAge(area({ last_reviewed_at: daysBefore(24) }), NOW)).toBe("24d")
  })
})
