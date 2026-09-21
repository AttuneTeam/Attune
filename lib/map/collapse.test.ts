import {
  COLLAPSED_DOMAINS_COOKIE,
  MAX_PERSISTED_DOMAINS,
  parseCollapsedDomains,
  persistCollapsedDomains,
  serialiseCollapsedDomains,
} from "./collapse"

/**
 * Which domains the manager has collapsed, persisted across visits.
 *
 * The value comes back from a cookie, which means it is untrusted input that
 * can be stale, truncated, hand-edited or absent. Every one of those must
 * produce a usable map rather than a thrown error — a corrupt preference is
 * never a reason to fail to render someone's territory.
 *
 * Domains are stored as their own values, null included, rather than as
 * stringified keys. A manager whose domain is literally called "ungrouped"
 * would otherwise collide with the null bucket.
 */

describe("parseCollapsedDomains", () => {
  it("reads a stored list", () => {
    const parsed = parseCollapsedDomains(JSON.stringify(["Platform", "People"]))
    expect(parsed.has("Platform")).toBe(true)
    expect(parsed.has("People")).toBe(true)
    expect(parsed.size).toBe(2)
  })

  it("distinguishes the ungrouped bucket from a domain named 'ungrouped'", () => {
    const parsed = parseCollapsedDomains(JSON.stringify([null, "ungrouped"]))
    expect(parsed.has(null)).toBe(true)
    expect(parsed.has("ungrouped")).toBe(true)
    expect(parsed.size).toBe(2)
  })

  it("returns nothing collapsed when there is no cookie", () => {
    // First visit. Everything expanded is the right default: the map's job is
    // to show the whole surface.
    expect(parseCollapsedDomains(undefined).size).toBe(0)
    expect(parseCollapsedDomains("").size).toBe(0)
  })

  it("survives malformed JSON", () => {
    expect(parseCollapsedDomains("{not json").size).toBe(0)
    expect(parseCollapsedDomains('["Platform"').size).toBe(0)
  })

  it("survives valid JSON of the wrong shape", () => {
    expect(parseCollapsedDomains('"Platform"').size).toBe(0)
    expect(parseCollapsedDomains("42").size).toBe(0)
    expect(parseCollapsedDomains('{"Platform":true}').size).toBe(0)
  })

  it("discards entries that are neither a string nor null", () => {
    const parsed = parseCollapsedDomains(JSON.stringify(["Platform", 7, {}, null]))
    expect([...parsed]).toEqual(["Platform", null])
  })

  it("ignores anything beyond the persisted cap", () => {
    // A cookie over ~4KB is silently dropped by the browser, which would lose
    // the preference entirely rather than partially.
    const many = Array.from({ length: MAX_PERSISTED_DOMAINS + 10 }, (_, i) => `d${i}`)
    expect(parseCollapsedDomains(JSON.stringify(many)).size).toBe(MAX_PERSISTED_DOMAINS)
  })
})

describe("serialiseCollapsedDomains", () => {
  it("round-trips through parse", () => {
    const original = new Set<string | null>(["Platform", null, "Business"])
    const parsed = parseCollapsedDomains(serialiseCollapsedDomains(original))
    expect([...parsed].sort()).toEqual([...original].sort())
  })

  it("round-trips a domain containing punctuation", () => {
    // Domains are free text: commas, quotes and non-ASCII all have to survive.
    const original = new Set<string | null>(['Platform, "core"', "Führung"])
    const parsed = parseCollapsedDomains(serialiseCollapsedDomains(original))
    expect(parsed.has('Platform, "core"')).toBe(true)
    expect(parsed.has("Führung")).toBe(true)
  })

  it("serialises nothing collapsed as an empty list", () => {
    expect(parseCollapsedDomains(serialiseCollapsedDomains(new Set())).size).toBe(0)
  })

  it("truncates at the cap rather than writing a cookie the browser will drop", () => {
    const many = new Set<string | null>(
      Array.from({ length: MAX_PERSISTED_DOMAINS + 10 }, (_, i) => `d${i}`),
    )
    const parsed = parseCollapsedDomains(serialiseCollapsedDomains(many))
    expect(parsed.size).toBe(MAX_PERSISTED_DOMAINS)
  })
})

describe("COLLAPSED_DOMAINS_COOKIE", () => {
  it("follows the project's existing cookie naming", () => {
    // sidebar-collapsed already exists; matching it keeps the set legible.
    expect(COLLAPSED_DOMAINS_COOKIE).toBe("map-collapsed-domains")
  })
})

describe("persistCollapsedDomains", () => {
  it("does nothing when there is no document", () => {
    // Called only from a client handler, but a module that throws when
    // imported server-side is a trap waiting for the next caller.
    expect(() => persistCollapsedDomains(new Set(["Platform"]))).not.toThrow()
  })
})
