import { summariseCoverage, type CoverageSummary } from "./coverage"
import type { MapArea } from "./types"

/**
 * Turns a flat query result into the map's shape: domains as territories, areas
 * nested beneath them.
 *
 * Two rules govern this module. Nothing is ever dropped — a row it cannot place
 * is still something the manager wrote down, and a map that silently loses an
 * area would quietly under-report the very surface it exists to show. And the
 * group order is the manager's, taken from the domain rows (FR10), never
 * derived from the areas.
 */

/** The minimum a domain row must carry to head a group. */
export type DomainRef = {
  id: string
  name: string
  sort_order: number
}

/** The minimum an area must carry to be grouped, nested and summarised. */
export type GroupableArea = Pick<
  MapArea,
  "id" | "domain_id" | "parent_id" | "confidence" | "last_reviewed_at" | "created_at" | "owner_id"
>

export type AreaNode<T extends GroupableArea> = T & { children: AreaNode<T>[] }

export type DomainGroup<T extends GroupableArea = MapArea> = {
  /** Null for the ungrouped bucket. */
  domainId: string | null
  /** Display name. Null for the ungrouped bucket. */
  domain: string | null
  roots: AreaNode<T>[]
  summary: CoverageSummary
}

/**
 * True when following parent_id upward from this area revisits a node.
 *
 * The depth CHECK makes a cycle unreachable through the application, but a
 * transform that recursed forever on bad data would take the whole page down
 * rather than degrade. A cyclic area is treated as a root: visibly odd, but
 * present and editable, which is what lets the manager fix it.
 */
function hasCycle(start: GroupableArea, byId: Map<string, GroupableArea>): boolean {
  const seen = new Set<string>([start.id])
  let parentId = start.parent_id

  while (parentId) {
    if (seen.has(parentId)) return true
    const parent = byId.get(parentId)
    // A missing parent is an orphan, not a cycle — handled by the caller.
    if (!parent) return false
    seen.add(parentId)
    parentId = parent.parent_id
  }

  return false
}

/**
 * Groups areas under their domains, nesting children beneath their parents.
 *
 * Every domain gets a group, including one holding nothing — that is what lets
 * a manager frame a territory before filling it, and it is why the domain list
 * is passed in rather than derived from the areas.
 *
 * Nesting wins over domain: a child follows its parent's group even when its
 * own domain differs, because showing it under a different heading would break
 * the tree the manager built. Only roots decide which group they land in.
 */
export function groupAreasByDomain<T extends GroupableArea>(
  areas: readonly T[],
  domains: readonly DomainRef[],
  now: Date = new Date(),
): DomainGroup<T>[] {
  const byId = new Map<string, T>(areas.map((a) => [a.id, a]))
  const nodes = new Map<string, AreaNode<T>>(
    areas.map((a) => [a.id, { ...a, children: [] } as AreaNode<T>]),
  )

  const roots: AreaNode<T>[] = []

  // Input order is preserved within every level: the query orders by depth then
  // the manager's sort_order, and reshuffling here would move areas between
  // visits for no visible reason.
  for (const item of areas) {
    const node = nodes.get(item.id)!
    const parent = item.parent_id ? nodes.get(item.parent_id) : undefined

    if (parent && !hasCycle(item, byId)) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const known = new Set(domains.map((d) => d.id))
  const byDomain = new Map<string | null, AreaNode<T>[]>()

  for (const root of roots) {
    // An unknown domain id — deleted concurrently, or absent from this result
    // set — falls into ungrouped rather than being dropped.
    const key = root.domain_id && known.has(root.domain_id) ? root.domain_id : null
    const existing = byDomain.get(key)
    if (existing) existing.push(root)
    else byDomain.set(key, [root])
  }

  const ordered = [...domains].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  )

  const groups: DomainGroup<T>[] = ordered.map((domain) => {
    const groupRoots = byDomain.get(domain.id) ?? []
    return {
      domainId: domain.id,
      domain: domain.name,
      roots: groupRoots,
      // Summarised over the whole subtree: "how many areas it holds" means all
      // of them, and counting only roots would report a domain of one when it
      // holds three.
      summary: summariseCoverage(collect(groupRoots), now),
    }
  })

  // The ungrouped bucket is a holding pen, not a territory: it appears only
  // when something is in it, and always last.
  const loose = byDomain.get(null)
  if (loose && loose.length > 0) {
    groups.push({
      domainId: null,
      domain: null,
      roots: loose,
      summary: summariseCoverage(collect(loose), now),
    })
  }

  return groups
}

/** Every area in the given groups, depth-first, groups in order. */
export function flattenAreas<T extends GroupableArea>(
  groups: readonly DomainGroup<T>[],
): AreaNode<T>[] {
  return groups.flatMap((group) => collect(group.roots))
}

function collect<T extends GroupableArea>(nodes: readonly AreaNode<T>[]): AreaNode<T>[] {
  return nodes.flatMap((node) => [node, ...collect(node.children)])
}

/**
 * How many areas sit beneath this one, at any depth.
 *
 * Used by the removal affordance, which tells the manager the number before
 * acting. Removal cascades (parent_id is ON DELETE CASCADE), so this figure is
 * the difference between an informed action and a nasty surprise — and it has
 * to count the whole subtree, not just direct children.
 */
export function countDescendants<T extends GroupableArea>(node: AreaNode<T>): number {
  return node.children.reduce(
    (total, child) => total + 1 + countDescendants(child),
    0,
  )
}
