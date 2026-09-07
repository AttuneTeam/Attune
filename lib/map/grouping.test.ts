import {
  countDescendants,
  flattenAreas,
  groupAreasByDomain,
  type DomainRef,
  type GroupableArea,
} from "./grouping"

/**
 * Turning a flat query result into the map's shape: domains as territories,
 * areas nested beneath them.
 *
 * Two rules govern everything here. Nothing is ever dropped — a row this
 * transform cannot place is still something the manager wrote down, and a map
 * that silently loses an area would under-report the very surface it exists to
 * show. And the group order is the manager's, taken from the domain rows
 * (FR10), not derived from the areas.
 */

const NOW = new Date("2026-09-07T12:00:00.000Z")

function daysBefore(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

const PLATFORM: DomainRef = { id: "d-platform", name: "Platform", sort_order: 1 }
const PEOPLE: DomainRef = { id: "d-people", name: "People", sort_order: 2 }
const BUSINESS: DomainRef = { id: "d-business", name: "Business", sort_order: 3 }

let seq = 0

function area(overrides: Partial<GroupableArea> = {}): GroupableArea {
  seq += 1
  return {
    id: `area-${seq}`,
    domain_id: PLATFORM.id,
    parent_id: null,
    confidence: "aware",
    last_reviewed_at: daysBefore(1),
    created_at: daysBefore(10),
    owner_id: "member-1",
    ...overrides,
  }
}

describe("groupAreasByDomain", () => {
  it("groups areas under their domain", () => {
    const groups = groupAreasByDomain(
      [
        area({ id: "p1", domain_id: PLATFORM.id }),
        area({ id: "b1", domain_id: BUSINESS.id }),
        area({ id: "p2", domain_id: PLATFORM.id }),
      ],
      [PLATFORM, BUSINESS],
      NOW,
    )
    expect(groups.map((g) => g.domain)).toEqual(["Platform", "Business"])
    expect(groups[0].roots.map((a) => a.id)).toEqual(["p1", "p2"])
  })

  it("orders groups by the manager's own order, not alphabetically", () => {
    // The whole point of FR10. Alphabetically this would be Business, People,
    // Platform; the manager put Platform first and that has to win.
    const groups = groupAreasByDomain(
      [area({ domain_id: BUSINESS.id }), area({ domain_id: PLATFORM.id })],
      [PLATFORM, PEOPLE, BUSINESS],
      NOW,
    )
    expect(groups.map((g) => g.domain)).toEqual(["Platform", "People", "Business"])
  })

  it("shows a domain that holds nothing yet", () => {
    // Empty domains are now expressible, which is what lets the manager frame
    // a territory before filling it.
    const groups = groupAreasByDomain([area({ domain_id: PLATFORM.id })], [PLATFORM, PEOPLE], NOW)
    expect(groups.map((g) => g.domain)).toEqual(["Platform", "People"])
    expect(groups[1].roots).toEqual([])
    expect(groups[1].summary.total).toBe(0)
  })

  it("puts ungrouped areas last, and only when there are some", () => {
    const withLoose = groupAreasByDomain(
      [area({ id: "loose", domain_id: null }), area({ id: "placed", domain_id: PLATFORM.id })],
      [PLATFORM],
      NOW,
    )
    expect(withLoose.map((g) => g.domain)).toEqual(["Platform", null])
    expect(withLoose[1].roots.map((a) => a.id)).toEqual(["loose"])

    const withoutLoose = groupAreasByDomain([area({ domain_id: PLATFORM.id })], [PLATFORM], NOW)
    expect(withoutLoose.map((g) => g.domain)).toEqual(["Platform"])
  })

  it("does not lose an area whose domain is unknown to the result set", () => {
    // Deleted concurrently, or simply absent. Dropping it would under-report
    // the surface; it falls into ungrouped where the manager can re-file it.
    const groups = groupAreasByDomain(
      [area({ id: "orphan", domain_id: "d-vanished" })],
      [PLATFORM],
      NOW,
    )
    const ungrouped = groups.find((g) => g.domainId === null)
    expect(ungrouped?.roots.map((a) => a.id)).toEqual(["orphan"])
  })

  it("nests children under their parent, to two levels", () => {
    const groups = groupAreasByDomain(
      [
        area({ id: "root" }),
        area({ id: "child", parent_id: "root" }),
        area({ id: "grandchild", parent_id: "child" }),
      ],
      [PLATFORM],
      NOW,
    )
    const root = groups[0].roots[0]
    expect(root.id).toBe("root")
    expect(root.children[0].id).toBe("child")
    expect(root.children[0].children[0].id).toBe("grandchild")
  })

  it("keeps a child with its parent even when their domains differ", () => {
    // Nesting wins over domain. Showing a child under a different heading would
    // break the tree the manager built.
    const groups = groupAreasByDomain(
      [
        area({ id: "root", domain_id: PLATFORM.id }),
        area({ id: "child", parent_id: "root", domain_id: PEOPLE.id }),
      ],
      [PLATFORM, PEOPLE],
      NOW,
    )
    expect(groups[0].roots[0].children.map((a) => a.id)).toEqual(["child"])
    expect(groups[1].roots).toEqual([])
  })

  it("surfaces an orphaned child as a root rather than dropping it", () => {
    const groups = groupAreasByDomain(
      [area({ id: "orphan", parent_id: "vanished" })],
      [PLATFORM],
      NOW,
    )
    expect(groups[0].roots.map((a) => a.id)).toEqual(["orphan"])
  })

  it("does not lose a row to a parent cycle", () => {
    const groups = groupAreasByDomain(
      [area({ id: "a", parent_id: "b" }), area({ id: "b", parent_id: "a" })],
      [PLATFORM],
      NOW,
    )
    expect(flattenAreas(groups).map((a) => a.id).sort()).toEqual(["a", "b"])
  })

  it("preserves input order within a level", () => {
    const groups = groupAreasByDomain(
      [area({ id: "first" }), area({ id: "second" }), area({ id: "third" })],
      [PLATFORM],
      NOW,
    )
    expect(groups[0].roots.map((a) => a.id)).toEqual(["first", "second", "third"])
  })

  it("summarises every area in the group, nested ones included", () => {
    const groups = groupAreasByDomain(
      [
        area({ id: "root", confidence: "owned" }),
        area({ id: "child", parent_id: "root", confidence: "unknown" }),
        area({ id: "grandchild", parent_id: "child", confidence: "unknown" }),
      ],
      [PLATFORM],
      NOW,
    )
    expect(groups[0].summary.total).toBe(3)
    expect(groups[0].summary.counts).toEqual({
      unknown: 2,
      aware: 0,
      understood: 0,
      owned: 1,
    })
  })

  it("counts attention across nested areas too", () => {
    const groups = groupAreasByDomain(
      [
        area({ id: "root" }),
        area({ id: "child", parent_id: "root", owner_id: null }),
        area({ id: "grandchild", parent_id: "child", last_reviewed_at: daysBefore(60) }),
      ],
      [PLATFORM],
      NOW,
    )
    expect(groups[0].summary.attention).toBe(2)
  })

  it("returns nothing for no areas and no domains", () => {
    expect(groupAreasByDomain([], [], NOW)).toEqual([])
  })
})

describe("flattenAreas", () => {
  it("returns every area across every group and depth", () => {
    const groups = groupAreasByDomain(
      [
        area({ id: "p", domain_id: PLATFORM.id }),
        area({ id: "pc", domain_id: PLATFORM.id, parent_id: "p" }),
        area({ id: "b", domain_id: BUSINESS.id }),
      ],
      [PLATFORM, BUSINESS],
      NOW,
    )
    expect(flattenAreas(groups).map((a) => a.id)).toEqual(["p", "pc", "b"])
  })

  it("is empty for no groups", () => {
    expect(flattenAreas([])).toEqual([])
  })
})

describe("countDescendants", () => {
  it("counts nothing for a leaf", () => {
    const groups = groupAreasByDomain([area({ id: "leaf" })], [PLATFORM], NOW)
    expect(countDescendants(groups[0].roots[0])).toBe(0)
  })

  it("counts the whole subtree, not just one level", () => {
    // The removal copy promises a number, and cascade deletion makes that
    // number the difference between an informed action and a nasty surprise.
    const groups = groupAreasByDomain(
      [
        area({ id: "r" }),
        area({ id: "c", parent_id: "r" }),
        area({ id: "gc", parent_id: "c" }),
      ],
      [PLATFORM],
      NOW,
    )
    expect(countDescendants(groups[0].roots[0])).toBe(2)
  })
})
