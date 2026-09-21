import {
  MAX_SUGGESTIONS,
  areaSuggestionsSchema,
  buildAreaSuggestionPrompt,
} from "./suggestSchema"

/**
 * The brain dump's contract with the model.
 *
 * Everything here exists because AI output is untrusted input that happens to
 * look plausible. product-guidelines.md holds it to a higher bar than UI
 * chrome: extract only what is real, and when in doubt return less. A confident
 * hallucination costs more trust than an empty result.
 */

describe("areaSuggestionsSchema", () => {
  it("accepts a grouped proposal", () => {
    const parsed = areaSuggestionsSchema.parse({
      areas: [
        { title: "Agency handover", domain: "Platform" },
        { title: "Hire 2 seniors", domain: "People" },
        { title: "Something loose", domain: null },
      ],
    })
    expect(parsed.areas).toHaveLength(3)
    expect(parsed.areas[2].domain).toBeNull()
  })

  it("accepts an empty proposal", () => {
    // "When in doubt, return less" has to include returning nothing. Treating
    // an empty result as a failure would push the model to invent.
    expect(areaSuggestionsSchema.parse({ areas: [] }).areas).toEqual([])
  })

  it("rejects a missing or malformed payload", () => {
    expect(areaSuggestionsSchema.safeParse({}).success).toBe(false)
    expect(areaSuggestionsSchema.safeParse({ areas: "Platform" }).success).toBe(false)
    expect(areaSuggestionsSchema.safeParse({ areas: [{ domain: "Platform" }] }).success).toBe(false)
    expect(areaSuggestionsSchema.safeParse({ areas: [{ title: "" }] }).success).toBe(false)
  })

  it("rejects fields the model has no business setting", () => {
    // The model proposes areas. Confidence is the manager's judgement and an
    // owner is a real person's name — a hallucinated one would be worse than
    // useless.
    for (const extra of [
      { confidence: "aware" },
      { owner_id: "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60" },
      { owner: "Sam" },
      { last_reviewed_at: "2026-01-01" },
    ]) {
      expect(
        areaSuggestionsSchema.safeParse({ areas: [{ title: "a", domain: null, ...extra }] })
          .success,
        `${Object.keys(extra)[0]} was accepted from the model`,
      ).toBe(false)
    }
  })

  it("caps how many areas one dump can propose", () => {
    // A runaway response would otherwise present the manager with hundreds of
    // checkboxes, which is not a review — it is a rubber stamp.
    const many = Array.from({ length: MAX_SUGGESTIONS + 1 }, (_, i) => ({
      title: `area ${i}`,
      domain: null,
    }))
    expect(areaSuggestionsSchema.safeParse({ areas: many }).success).toBe(false)
  })

  it("rejects an absurdly long title or domain", () => {
    expect(
      areaSuggestionsSchema.safeParse({ areas: [{ title: "x".repeat(201), domain: null }] })
        .success,
    ).toBe(false)
    expect(
      areaSuggestionsSchema.safeParse({ areas: [{ title: "a", domain: "y".repeat(81) }] })
        .success,
    ).toBe(false)
  })
})

describe("buildAreaSuggestionPrompt", () => {
  it("includes the manager's own words", () => {
    const prompt = buildAreaSuggestionPrompt("agency still owns deploys", [])
    expect(prompt).toContain("agency still owns deploys")
  })

  it("offers the existing domains so it reuses rather than invents", () => {
    // Without this the model coins "Tech" alongside the manager's "Platform"
    // and the map fragments on the first dump.
    const prompt = buildAreaSuggestionPrompt("something", ["Platform", "People"])
    expect(prompt).toContain("Platform")
    expect(prompt).toContain("People")
  })

  it("says plainly when there are no domains yet", () => {
    const prompt = buildAreaSuggestionPrompt("something", [])
    expect(prompt.toLowerCase()).toContain("no domains")
  })
})
