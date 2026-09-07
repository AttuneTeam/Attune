import {
  createAreaInput,
  toAreaUpdate,
  updateAreaInput,
  type UpdateAreaInput,
} from "./areaInput"
import type { AreaConfidence } from "@/lib/supabase/types"

/**
 * Validation for everything a client may write to an area.
 *
 * Two jobs. Reject malformed input, obviously — but more importantly, define
 * what a client is *allowed* to set. `kind`, `manager_id`, `depth` and
 * `last_reviewed_at` are all server-owned; the schemas are strict so an attempt
 * to set one is a loud 400 rather than a silent success that quietly detaches a
 * row from its owner.
 */

const NOW = new Date("2026-09-07T12:00:00.000Z")

/**
 * Type-level assertion, checked by `npx tsc --noEmit` rather than at runtime.
 *
 * The first version of the schema cast CONFIDENCE_ORDER through
 * `[string, ...string[]]` to satisfy z.enum, which widened `confidence` to
 * plain `string` and turned every confidence typo into a runtime problem. This
 * line fails to compile if that cast comes back. Verified by reintroducing it:
 * tsc reports "Type 'string | undefined' is not assignable to type
 * 'AreaConfidence | undefined'".
 */
const confidenceInfersAsUnion: AreaConfidence | undefined = (
  {} as UpdateAreaInput
).confidence
void confidenceInfersAsUnion

describe("createAreaInput", () => {
  it("accepts a title alone", () => {
    const parsed = createAreaInput.parse({ title: "Agency handover" })
    expect(parsed.title).toBe("Agency handover")
  })

  it("trims the title", () => {
    // Quick-add commits on Enter, so a stray space is the norm rather than the
    // exception.
    expect(createAreaInput.parse({ title: "  Payments  " }).title).toBe("Payments")
  })

  it("rejects an empty or whitespace-only title", () => {
    expect(createAreaInput.safeParse({ title: "" }).success).toBe(false)
    expect(createAreaInput.safeParse({ title: "   " }).success).toBe(false)
    expect(createAreaInput.safeParse({}).success).toBe(false)
  })

  it("rejects an absurdly long title", () => {
    expect(createAreaInput.safeParse({ title: "x".repeat(201) }).success).toBe(false)
  })

  it("accepts a domain reference, or none", () => {
    // Null is ungrouped, which is a real state: capture must never be blocked
    // on choosing a heading first.
    expect(
      createAreaInput.parse({ title: "a", domain_id: "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60" })
        .domain_id,
    ).toBe("6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60")
    expect(createAreaInput.parse({ title: "a", domain_id: null }).domain_id).toBeNull()
    expect(createAreaInput.parse({ title: "a" }).domain_id).toBeUndefined()
  })

  it("refuses a domain name where a reference is expected", () => {
    // Domains are rows now. Accepting a string would silently create an area
    // that no group can claim.
    expect(createAreaInput.safeParse({ title: "a", domain: "Platform" }).success).toBe(false)
    expect(createAreaInput.safeParse({ title: "a", domain_id: "Platform" }).success).toBe(false)
  })

  it("requires parent_id to be a uuid when given", () => {
    expect(createAreaInput.safeParse({ title: "a", parent_id: "nope" }).success).toBe(
      false,
    )
    expect(
      createAreaInput.safeParse({
        title: "a",
        parent_id: "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60",
      }).success,
    ).toBe(true)
  })

  it("refuses to let a client set server-owned fields", () => {
    // kind decides whether a row is an area or an initiative; manager_id is the
    // tenancy boundary; depth and last_reviewed_at are derived. A client that
    // sends any of them is confused, and silently dropping them would hide a
    // real bug in the caller.
    for (const field of [
      { kind: "initiative" },
      { manager_id: "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60" },
      { depth: 0 },
      { last_reviewed_at: NOW.toISOString() },
      { confidence: "owned" },
      { domain: "Platform" },
    ]) {
      expect(
        createAreaInput.safeParse({ title: "a", ...field }).success,
        `${Object.keys(field)[0]} was accepted on create`,
      ).toBe(false)
    }
  })
})

describe("updateAreaInput", () => {
  it("accepts a single field", () => {
    expect(updateAreaInput.safeParse({ confidence: "aware" }).success).toBe(true)
    expect(updateAreaInput.safeParse({ title: "Renamed" }).success).toBe(true)
    expect(updateAreaInput.safeParse({ owner_id: null }).success).toBe(true)
    expect(updateAreaInput.safeParse({ reviewed: true }).success).toBe(true)
  })

  it("rejects an empty body", () => {
    // A PATCH with nothing in it is a caller bug, not a no-op worth honouring.
    expect(updateAreaInput.safeParse({}).success).toBe(false)
  })

  it("validates the confidence enum", () => {
    expect(updateAreaInput.safeParse({ confidence: "quite sure" }).success).toBe(false)
    for (const confidence of ["unknown", "aware", "understood", "owned"]) {
      expect(updateAreaInput.safeParse({ confidence }).success).toBe(true)
    }
  })

  it("only accepts reviewed as an explicit true", () => {
    // `reviewed: false` has no meaning — there is no way to un-review something.
    expect(updateAreaInput.safeParse({ reviewed: false }).success).toBe(false)
  })

  it("refuses to let a client set server-owned fields", () => {
    for (const field of [
      { kind: "initiative" },
      { manager_id: "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60" },
      { depth: 2 },
      { last_reviewed_at: NOW.toISOString() },
      { parent_id: "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60" },
      { domain: "Platform" },
    ]) {
      expect(
        updateAreaInput.safeParse(field).success,
        `${Object.keys(field)[0]} was accepted on update`,
      ).toBe(false)
    }
  })
})

describe("toAreaUpdate", () => {
  it("stamps the review time when confidence changes", () => {
    // FR3: changing confidence *is* a review. Not stamping it would leave an
    // area the manager just reassessed still counting towards staleness.
    const patch = toAreaUpdate({ confidence: "understood" }, NOW)
    expect(patch).toEqual({
      confidence: "understood",
      last_reviewed_at: NOW.toISOString(),
    })
  })

  it("stamps the review time without touching confidence", () => {
    // FR3's second affordance: the manager looked and nothing had changed.
    const patch = toAreaUpdate({ reviewed: true }, NOW)
    expect(patch).toEqual({ last_reviewed_at: NOW.toISOString() })
    expect("confidence" in patch).toBe(false)
  })

  it("does not stamp a review for a rename or a re-domain", () => {
    // Renaming an area is not looking at it. Treating it as a review would let
    // tidying up silently reset the staleness clock across the whole map.
    expect(toAreaUpdate({ title: "Renamed" }, NOW)).toEqual({ title: "Renamed" })
    expect(toAreaUpdate({ domain_id: null }, NOW)).toEqual({ domain_id: null })
  })

  it("does not stamp a review for an ownership change", () => {
    expect(toAreaUpdate({ owner_id: null }, NOW)).toEqual({ owner_id: null })
  })

  it("combines a confidence change with other fields", () => {
    expect(toAreaUpdate({ confidence: "owned", owner_id: "m1" }, NOW)).toEqual({
      confidence: "owned",
      owner_id: "m1",
      last_reviewed_at: NOW.toISOString(),
    })
  })

  it("never emits a server-owned field", () => {
    const patch = toAreaUpdate({ confidence: "aware", reviewed: true }, NOW)
    for (const forbidden of ["kind", "manager_id", "depth", "parent_id", "reviewed"]) {
      expect(forbidden in patch, `${forbidden} leaked into the patch`).toBe(false)
    }
  })
})
