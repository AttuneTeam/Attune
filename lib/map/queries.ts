import type { SupabaseClient } from "@supabase/supabase-js"
import type { DomainRef } from "./grouping"
import type { AreaOwner, MapArea } from "./types"

/**
 * The Surface Area Map's list query.
 *
 * Deliberately one query. The map shows a manager's whole territory at once, so
 * anything resolved per row -- an owner's name most obviously -- would be an
 * N+1 across the entire surface. The owner is embedded instead.
 */

/**
 * The owner embed names its foreign key explicitly. There is only one FK from
 * strategic_initiatives to team_members today, so PostgREST could infer it, but
 * a second one added later would turn inference into an ambiguity error at
 * runtime rather than a compile error here.
 */
export const MAP_AREA_SELECT = [
  "id",
  "title",
  "domain",
  "domain_id",
  "parent_id",
  "depth",
  "kind",
  "confidence",
  "last_reviewed_at",
  "created_at",
  "owner_id",
  "owner:team_members!strategic_initiatives_owner_id_fkey(id, name)",
].join(", ")

/**
 * Success and failure are distinct rather than an array that happens to be
 * empty. "You have no areas yet" and "your areas could not be loaded" are
 * different sentences, and rendering the second as the first would be a quiet
 * lie -- product-guidelines.md UX principle 7.
 */
export type MapAreasResult =
  | { ok: true; areas: MapArea[] }
  | { ok: false; message: string }

/** PostgREST returns a to-one embed as an object, or as an array when it cannot infer cardinality. */
type RawOwner = AreaOwner | AreaOwner[] | null

type RawArea = Omit<MapArea, "owner"> & { owner: RawOwner }

function normaliseOwner(owner: RawOwner): AreaOwner | null {
  if (!owner) return null
  if (Array.isArray(owner)) return owner[0] ?? null
  return owner
}

export async function fetchMapAreas(
  supabase: SupabaseClient,
  managerId: string,
): Promise<MapAreasResult> {
  const { data, error } = await supabase
    .from("strategic_initiatives")
    .select(MAP_AREA_SELECT)
    // RLS already scopes this. The explicit manager_id keeps the
    // (manager_id, kind) index usable and states the intent at the call site.
    .eq("manager_id", managerId)
    .eq("kind", "area")
    // depth first, so the grouping transform -- which preserves input order --
    // always sees a parent before its children. Then the manager's own order
    // (FR9). created_at last, purely as a tiebreak: without it two areas
    // sharing a position could render in a different order between requests.
    .order("depth", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) return { ok: false, message: error.message }
  if (!data) return { ok: false, message: "The map could not be loaded." }

  const rows = data as unknown as RawArea[]
  return {
    ok: true,
    areas: rows.map((row) => ({ ...row, owner: normaliseOwner(row.owner) })),
  }
}

/**
 * The manager's domains, in their order.
 *
 * Fetched separately rather than derived from the areas: FR10 makes an empty
 * domain a real thing, and a domain with nothing in it would be invisible if
 * the list came from the rows filed under it. Two constant-size queries, never
 * one per row.
 */
export async function fetchMapDomains(
  supabase: SupabaseClient,
  managerId: string,
): Promise<DomainRef[]> {
  const { data } = await supabase
    .from("map_domains")
    .select("id, name, sort_order")
    .eq("manager_id", managerId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  return (data ?? []) as unknown as DomainRef[]
}
