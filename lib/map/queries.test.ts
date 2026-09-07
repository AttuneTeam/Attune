import type { SupabaseClient } from "@supabase/supabase-js"
import { MAP_AREA_SELECT, fetchMapAreas } from "./queries"

/**
 * The map's list query.
 *
 * Two properties are worth testing without a database. First the shape: one
 * query, scoped to the caller, filtered to areas, with the owner resolved in
 * the same round trip — FR2 and the performance requirement both hinge on
 * there being exactly one. Second the failure mode: a query that fails must not
 * render as an empty map, because "you have no areas" and "we could not load
 * your areas" are different sentences and only one of them is true.
 */

type QueryResult = { data: unknown; error: { message: string } | null }

type RecordedQuery = {
  table: string
  select: string | null
  filters: Array<{ column: string; value: unknown }>
  orders: Array<{ column: string; ascending?: boolean }>
}

/** Records the builder chain and resolves to a canned result. */
function fakeClient(result: QueryResult) {
  const queries: RecordedQuery[] = []

  function builder(record: RecordedQuery) {
    const chain = {
      select(columns: string) {
        record.select = columns
        return chain
      },
      eq(column: string, value: unknown) {
        record.filters.push({ column, value })
        return chain
      },
      order(column: string, options?: { ascending?: boolean }) {
        record.orders.push({ column, ascending: options?.ascending })
        return chain
      },
      then<TResult1, TResult2 = never>(
        onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(result).then(onfulfilled, onrejected)
      },
    }
    return chain
  }

  const client = {
    from(table: string) {
      const record: RecordedQuery = { table, select: null, filters: [], orders: [] }
      queries.push(record)
      return builder(record)
    },
  }

  return { client: client as unknown as SupabaseClient, queries }
}

const OWNER = { id: "member-1", name: "Sam Okafor" }

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "area-1",
    title: "Agency handover",
    domain: "Platform",
    parent_id: null,
    depth: 0,
    kind: "area",
    confidence: "unknown",
    last_reviewed_at: null,
    created_at: "2026-08-01T00:00:00.000Z",
    owner_id: OWNER.id,
    owner: OWNER,
    ...overrides,
  }
}

describe("MAP_AREA_SELECT", () => {
  it("projects every column the map needs and no more", () => {
    for (const column of [
      "id",
      "title",
      "domain",
      "parent_id",
      "depth",
      "kind",
      "confidence",
      "last_reviewed_at",
      "created_at",
      "owner_id",
    ]) {
      expect(MAP_AREA_SELECT).toContain(column)
    }
  })

  it("resolves the owner in the same query", () => {
    // An owner name per row fetched separately would be an N+1 across the whole
    // map. The embed is what keeps it to one round trip.
    expect(MAP_AREA_SELECT).toContain("owner:team_members")
  })

  it("does not pull the Tiptap description into the list", () => {
    // description is a JSONB document only the detail panel reads. In the list
    // it would move kilobytes per row for nothing.
    expect(MAP_AREA_SELECT).not.toContain("description")
  })
})

describe("fetchMapAreas", () => {
  it("issues exactly one query", async () => {
    const { client, queries } = fakeClient({ data: [row()], error: null })
    await fetchMapAreas(client, "manager-1")
    expect(queries).toHaveLength(1)
    expect(queries[0].table).toBe("strategic_initiatives")
  })

  it("scopes to the caller and filters to areas", async () => {
    // RLS already scopes this, but an explicit manager_id keeps the index on
    // (manager_id, kind) usable and states the intent at the call site.
    const { client, queries } = fakeClient({ data: [], error: null })
    await fetchMapAreas(client, "manager-1")
    expect(queries[0].filters).toEqual([
      { column: "manager_id", value: "manager-1" },
      { column: "kind", value: "area" },
    ])
  })

  it("orders by depth then creation so parents precede their children", async () => {
    // The grouping transform preserves input order, so the ordering has to be
    // right here or areas would shuffle between visits.
    const { client, queries } = fakeClient({ data: [], error: null })
    await fetchMapAreas(client, "manager-1")
    expect(queries[0].orders).toEqual([
      { column: "depth", ascending: true },
      { column: "created_at", ascending: true },
    ])
  })

  it("returns the areas on success", async () => {
    const { client } = fakeClient({ data: [row()], error: null })
    const result = await fetchMapAreas(client, "manager-1")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.areas).toHaveLength(1)
    expect(result.areas[0].title).toBe("Agency handover")
    expect(result.areas[0].owner).toEqual(OWNER)
  })

  it("normalises an owner embedded as an array", async () => {
    // PostgREST returns a to-one embed as an object, but returns an array when
    // it cannot infer the cardinality. Normalising here means one shape reaches
    // the components instead of two.
    const { client } = fakeClient({ data: [row({ owner: [OWNER] })], error: null })
    const result = await fetchMapAreas(client, "manager-1")
    if (!result.ok) throw new Error("expected success")
    expect(result.areas[0].owner).toEqual(OWNER)
  })

  it("treats an empty owner embed as unowned", async () => {
    const { client } = fakeClient({ data: [row({ owner: [], owner_id: null })], error: null })
    const result = await fetchMapAreas(client, "manager-1")
    if (!result.ok) throw new Error("expected success")
    expect(result.areas[0].owner).toBeNull()
  })

  it("returns an empty list, not a failure, when the manager has no areas", async () => {
    const { client } = fakeClient({ data: [], error: null })
    const result = await fetchMapAreas(client, "manager-1")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.areas).toEqual([])
  })

  it("reports a failure rather than rendering as an empty map", async () => {
    // product-guidelines.md UX principle 7: fail quietly and honestly. An empty
    // map and a failed map must not look the same -- one of those is a lie.
    const { client } = fakeClient({ data: null, error: { message: "connection reset" } })
    const result = await fetchMapAreas(client, "manager-1")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain("connection reset")
  })

  it("treats a null payload as a failure", async () => {
    const { client } = fakeClient({ data: null, error: null })
    const result = await fetchMapAreas(client, "manager-1")
    expect(result.ok).toBe(false)
  })
})
