import {
  compareDomains,
  countDescendants,
  flattenAreas,
  groupAreasByDomain,
  type GroupableArea,
} from "./grouping"

/**
 * Turning a flat query result into the map's shape: domains as territories,
 * areas nested beneath them.
 *
 * The rule that matters most here is that nothing is ever dropped. A row the
 * transform cannot place is still a thing the manager wrote down, and a map
 * that silently loses an area is worse than no map — it would quietly under-
 * report the surface it exists to show.
 */

const NOW = new Date("2026-09-07T12:00:00.000Z")

function daysBefore(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

let seq = 0

function area(overrides: Partial<GroupableArea> = {}): GroupableArea {
  seq += 1
  return {
    id: `area-${seq}`,
    domain: "Platform",
    parent_id: null,
    confidence: "aware",
    last_reviewed_at: daysBefore(1),
    created_at: daysBefore(10),
    owner_id: "member-1",
    ...overrides,
  }
}

describe("groupAreasByDomain", () => {
  it("groups areas by their domain", () => {
    const groups = groupAreasByDomain(
      [
        area({ id: "p1", domain: "Platform" }),
        area({ id: "b1", domain: "Business" }),
        area({ id: "p2", domain: "Platform" }),
      ],
      NOW,
    )
    expect(groups.map((g) => g.domain)).toEqual(["Business", "Platform"])
    expect(groups[1].roots.map((a) => a.id)).toEqual(["p1", "p2"])
  })

  it("orders domains alphabetically", () => {
    // No ordering column exists on the table, so the order has to come from
    // somewhere predictable. Alphabetical is stable between visits, which the
    // calm-surface principle in product-guidelines.md asks for; sorting by
    // attention would rearrange the page under the manager.
    const groups = groupAreasByDomain(
      [
        area({ domain: "Process" }),
        area({ domain: "Business" }),
        area({ domain: "People" }),
        area({ domain: "Platform" }),
      ],
      NOW,
    )
    expect(groups.map((g) => g.domain)).toEqual([
      "Business",
      "People",
      "Platform",
      "Process",
    ])
  })

  it("puts areas with no domain in their own group, ordered last", () => {
    // Capture must never be blocked on picking a domain first, so an
    // ungrouped area is a normal state, not an error. It sits at the end
    // rather than the top: it is a holding pen, not a priority.
    const groups = groupAreasByDomain(
      [area({ id: "loose", domain: null }), area({ id: "placed", domain: "Platform" })],
      NOW,
    )
    expect(groups.map((g) => g.domain)).toEqual(["Platform", null])
    expect(groups[1].roots.map((a) => a.id)).toEqual(["loose"])
  })

  it("nests children under their parent", () => {
    const groups = groupAreasByDomain(
      [
        area({ id: "root", parent_id: null }),
        area({ id: "child", parent_id: "root" }),
      ],
      NOW,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].roots.map((a) => a.id)).toEqual(["root"])
    expect(groups[0].roots[0].children.map((a) => a.id)).toEqual(["child"])
  })

  it("nests to two levels deep", () => {
    const groups = groupAreasByDomain(
      [
        area({ id: "root" }),
        area({ id: "child", parent_id: "root" }),
        area({ id: "grandchild", parent_id: "child" }),
      ],
      NOW,
    )
    const root = groups[0].roots[0]
    expect(root.children[0].id).toBe("child")
    expect(root.children[0].children[0].id).toBe("grandchild")
    expect(root.children[0].children[0].children).toEqual([])
  })

  it("keeps a child with its parent even when their domains differ", () => {
    // Nesting wins over domain. A child belongs beside its parent; showing it
    // under a different heading would break the tree the manager built.
    const groups = groupAreasByDomain(
      [
        area({ id: "root", domain: "Platform" }),
        area({ id: "child", parent_id: "root", domain: "People" }),
      ],
      NOW,
    )
    expect(groups.map((g) => g.domain)).toEqual(["Platform"])
    expect(groups[0].roots[0].children.map((a) => a.id)).toEqual(["child"])
  })

  it("surfaces an orphaned child as a root rather than dropping it", () => {
    // The parent may be missing because it was deleted concurrently, or simply
    // absent from this result set. Either way the child is something the
    // manager wrote down, and silently discarding it would under-report the
    // surface the map exists to show.
    const groups = groupAreasByDomain(
      [area({ id: "orphan", parent_id: "vanished", domain: "Platform" })],
      NOW,
    )
    expect(groups[0].roots.map((a) => a.id)).toEqual(["orphan"])
  })

  it("does not lose a row to a parent cycle", () => {
    // Two rows pointing at each other. The depth CHECK makes this unreachable
    // through the application, but a transform that recursed forever on bad
    // data would take the whole page down.
    const groups = groupAreasByDomain(
      [area({ id: "a", parent_id: "b" }), area({ id: "b", parent_id: "a" })],
      NOW,
    )
    expect(flattenAreas(groups).map((a) => a.id).sort()).toEqual(["a", "b"])
  })

  it("preserves input order within a level", () => {
    // The query orders by depth then created_at. Grouping must not reshuffle
    // that, or areas would move between visits for no visible reason.
    const groups = groupAreasByDomain(
      [
        area({ id: "first", created_at: daysBefore(30) }),
        area({ id: "second", created_at: daysBefore(20) }),
        area({ id: "third", created_at: daysBefore(10) }),
      ],
      NOW,
    )
    expect(groups[0].roots.map((a) => a.id)).toEqual(["first", "second", "third"])
  })

  it("summarises every area in the group, nested ones included", () => {
    // "How many areas it holds" means all of them. Counting only roots would
    // report a domain of one when it holds three.
    const groups = groupAreasByDomain(
      [
        area({ id: "root", confidence: "owned" }),
        area({ id: "child", parent_id: "root", confidence: "unknown" }),
        area({ id: "grandchild", parent_id: "child", confidence: "unknown" }),
      ],
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
      NOW,
    )
    expect(groups[0].summary.attention).toBe(2)
  })

  it("returns no groups for no areas", () => {
    expect(groupAreasByDomain([], NOW)).toEqual([])
  })
})

describe("flattenAreas", () => {
  it("returns every area across every group and depth", () => {
    const groups = groupAreasByDomain(
      [
        area({ id: "p", domain: "Platform" }),
        area({ id: "pc", domain: "Platform", parent_id: "p" }),
        area({ id: "b", domain: "Business" }),
      ],
      NOW,
    )
    expect(flattenAreas(groups).map((a) => a.id)).toEqual(["b", "p", "pc"])
  })

  it("is empty for no groups", () => {
    expect(flattenAreas([])).toEqual([])
  })
})

describe("countDescendants", () => {
  function node(id: string, children: ReturnType<typeof area>[] = []) {
    return { ...area({ id }), children: children.map((c) => ({ ...c, children: [] })) }
  }

  it("counts nothing for a leaf", () => {
    expect(countDescendants(node("leaf"))).toBe(0)
  })

  it("counts direct children", () => {
    expect(countDescendants(node("root", [area(), area()]))).toBe(2)
  })

  it("counts the whole subtree, not just one level", () => {
    // The removal copy promises a number, and cascade deletion makes that
    // number the difference between an informed action and a nasty surprise.
    // Counting one level would under-report it.
    const grandchild = { ...area({ id: "gc" }), children: [] }
    const child = { ...area({ id: "c" }), children: [grandchild] }
    const root = { ...area({ id: "r" }), children: [child] }
    expect(countDescendants(root)).toBe(2)
  })

  it("counts a wide and deep tree", () => {
    const leaf = () => ({ ...area(), children: [] })
    const child = () => ({ ...area(), children: [leaf(), leaf()] })
    const root = { ...area({ id: "r" }), children: [child(), child()] }
    // 2 children + 4 grandchildren
    expect(countDescendants(root)).toBe(6)
  })
})

describe("compareDomains", () => {
  it("orders alphabetically", () => {
    const sorted = ["Process", "Business", "People"].sort(compareDomains)
    expect(sorted).toEqual(["Business", "People", "Process"])
  })

  it("puts the ungrouped bucket last", () => {
    // It is a holding pen, not a priority.
    expect([null, "Business"].sort(compareDomains)).toEqual(["Business", null])
    expect(["Business", null].sort(compareDomains)).toEqual(["Business", null])
  })

  it("treats two ungrouped buckets as equal", () => {
    expect(compareDomains(null, null)).toBe(0)
  })

  it("is exported so pending groups sort the same way as real ones", () => {
    // A newly named domain has to slot into the same order it will occupy once
    // it holds an area, or it would jump position the moment it becomes real.
    const merged = ["Platform", null, "Business", "Delivery"].sort(compareDomains)
    expect(merged).toEqual(["Business", "Delivery", "Platform", null])
  })
})
