import { summariseCoverage, type CoverageSummary } from "./coverage"
import type { MapArea } from "./types"

/**
 * Turns a flat query result into the map's shape: domains as territories, areas
 * nested beneath them.
 *
 * One rule governs everything here: nothing is ever dropped. A row this
 * transform cannot place is still something the manager wrote down, and a map
 * that silently loses an area would quietly under-report the very surface it
 * exists to show. Orphans and cycles therefore surface as roots rather than
 * disappearing.
 */

/** The minimum an area must carry to be grouped, nested and summarised. */
export type GroupableArea = Pick<
  MapArea,
  "id" | "domain" | "parent_id" | "confidence" | "last_reviewed_at" | "created_at" | "owner_id"
>

export type AreaNode<T extends GroupableArea> = T & { children: AreaNode<T>[] }

export type DomainGroup<T extends GroupableArea = MapArea> = {
  /** Null is a real group: capture is never blocked on choosing a domain first. */
  domain: string | null
  roots: AreaNode<T>[]
  summary: CoverageSummary
}

/**
 * The order domain groups appear in: alphabetical, with the ungrouped bucket
 * last.
 *
 * Exported because the map also renders domains that do not exist yet — a
 * newly named group holds no areas until the first one is added. It has to
 * slot into the position it will occupy once it is real, or it would jump the
 * moment it stops being pending.
 *
 * Alphabetical rather than by attention: the order has to be predictable
 * between visits, and a page that rearranges itself around what is wrong works
 * against the calm surface product-guidelines.md asks for.
 */
export function compareDomains(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b)
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
 * Groups areas by domain, nesting children under their parents.
 *
 * Nesting wins over domain: a child follows its parent's group even when its
 * own domain differs, because showing it under a different heading would break
 * the tree the manager built. Only roots decide which group they land in.
 *
 * Domains are ordered alphabetically with the ungrouped bucket last. There is
 * no ordering column on the table, so the order must come from somewhere
 * predictable — and predictable matters: sorting by attention would rearrange
 * the page between visits, against the calm-surface principle in
 * product-guidelines.md.
 */
export function groupAreasByDomain<T extends GroupableArea>(
  areas: readonly T[],
  now: Date = new Date(),
): DomainGroup<T>[] {
  const byId = new Map<string, T>(areas.map((a) => [a.id, a]))
  const nodes = new Map<string, AreaNode<T>>(
    areas.map((a) => [a.id, { ...a, children: [] } as AreaNode<T>]),
  )

  const roots: AreaNode<T>[] = []

  // Input order is preserved within every level: the query orders by depth then
  // created_at, and reshuffling here would move areas between visits for no
  // visible reason.
  for (const area of areas) {
    const node = nodes.get(area.id)!
    const parent = area.parent_id ? nodes.get(area.parent_id) : undefined

    if (parent && !hasCycle(area, byId)) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const byDomain = new Map<string | null, AreaNode<T>[]>()
  for (const root of roots) {
    const existing = byDomain.get(root.domain)
    if (existing) existing.push(root)
    else byDomain.set(root.domain, [root])
  }

  return [...byDomain.entries()]
    .sort(([a], [b]) => compareDomains(a, b))
    .map(([domain, groupRoots]) => ({
      domain,
      roots: groupRoots,
      // Summarised over the whole subtree: "how many areas it holds" means all
      // of them, and counting only roots would report a domain of one when it
      // holds three.
      summary: summariseCoverage(collect(groupRoots), now),
    }))
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
