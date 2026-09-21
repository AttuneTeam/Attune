import { summariseAcceptOutcome } from "./acceptOutcome"

/**
 * What the manager is told after accepting a brain dump.
 *
 * This exists because the first version silently lied: when a domain failed to
 * create, its areas were filed as ungrouped and the toast still read "Added 6
 * areas". Someone accepted a grouped proposal and received a flat one with no
 * mention. The message is now branchy enough to get wrong quietly, so it is a
 * tested function rather than an expression inside a component.
 */

describe("summariseAcceptOutcome", () => {
  it("reports a clean run", () => {
    expect(summariseAcceptOutcome({ added: 6, failed: 0, failedDomains: [] })).toEqual({
      ok: true,
      message: "Added 6 areas.",
    })
  })

  it("pluralises a single area", () => {
    expect(summariseAcceptOutcome({ added: 1, failed: 0, failedDomains: [] }).message).toBe(
      "Added 1 area.",
    )
  })

  it("reports areas that could not be saved", () => {
    const out = summariseAcceptOutcome({ added: 5, failed: 1, failedDomains: [] })
    expect(out.ok).toBe(false)
    expect(out.message).toBe("Added 5 areas, 1 could not be saved.")
  })

  it("says when a domain failed and what became of its areas", () => {
    // The defect this function exists to prevent.
    const out = summariseAcceptOutcome({ added: 6, failed: 0, failedDomains: ["Platform"] })
    expect(out.ok).toBe(false)
    expect(out.message).toBe(
      "Added 6 areas, Platform could not be created, so its areas are ungrouped.",
    )
  })

  it("lists several failed domains readably", () => {
    const out = summariseAcceptOutcome({
      added: 4,
      failed: 0,
      failedDomains: ["Platform", "Process"],
    })
    expect(out.message).toContain("Platform and Process")
    expect(out.message).toContain("those areas are ungrouped")
  })

  it("reports both kinds of failure together", () => {
    const out = summariseAcceptOutcome({ added: 3, failed: 2, failedDomains: ["People"] })
    expect(out.ok).toBe(false)
    expect(out.message).toContain("2 could not be saved")
    expect(out.message).toContain("People could not be created")
  })

  it("does not claim success when nothing was added", () => {
    const out = summariseAcceptOutcome({ added: 0, failed: 3, failedDomains: [] })
    expect(out.ok).toBe(false)
    expect(out.message).toBe("Added 0 areas, 3 could not be saved.")
  })
})
