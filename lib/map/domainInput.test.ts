import { createDomainInput, moveDomainInput, renameDomainInput } from "./domainInput"

describe("createDomainInput / renameDomainInput", () => {
  it("accepts and trims a name", () => {
    expect(createDomainInput.parse({ name: "  Platform  " }).name).toBe("Platform")
    expect(renameDomainInput.parse({ name: " People " }).name).toBe("People")
  })

  it("rejects an empty or whitespace-only name", () => {
    // A blank heading is not a domain; the database CHECK agrees, but failing
    // here gives the manager a sentence instead of a constraint violation.
    expect(createDomainInput.safeParse({ name: "" }).success).toBe(false)
    expect(createDomainInput.safeParse({ name: "   " }).success).toBe(false)
    expect(createDomainInput.safeParse({}).success).toBe(false)
  })

  it("rejects an absurdly long name", () => {
    expect(createDomainInput.safeParse({ name: "x".repeat(81) }).success).toBe(false)
  })

  it("refuses server-owned fields", () => {
    for (const field of [{ manager_id: "x" }, { sort_order: 2 }, { id: "x" }]) {
      expect(
        createDomainInput.safeParse({ name: "a", ...field }).success,
        `${Object.keys(field)[0]} was accepted`,
      ).toBe(false)
    }
  })
})

describe("moveDomainInput", () => {
  it("accepts only up or down", () => {
    expect(moveDomainInput.safeParse({ direction: "up" }).success).toBe(true)
    expect(moveDomainInput.safeParse({ direction: "down" }).success).toBe(true)
    expect(moveDomainInput.safeParse({ direction: "sideways" }).success).toBe(false)
  })

  it("refuses an absolute position", () => {
    expect(moveDomainInput.safeParse({ sort_order: 1 }).success).toBe(false)
  })
})
