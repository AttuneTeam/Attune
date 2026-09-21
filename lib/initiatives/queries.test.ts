import { fakeSupabase } from "@/lib/test-utils/fakeSupabase"
import { fetchInitiativeChildren, fetchInitiatives } from "./queries"

/**
 * /initiatives and /map are two lenses over one table, separated only by
 * `kind`. If either lens forgets its filter the two features bleed into each
 * other: the manager's strategic work would fill up with onboarding areas, or
 * the map would sprout initiatives it never captured.
 *
 * Migration 042 defaults kind to 'initiative', so before this filter existed
 * /initiatives happened to be correct — right up until the first area was
 * created. These tests are what stop that being rediscovered by accident.
 */

const initiativeRow = {
  id: "init-1",
  manager_id: "manager-1",
  title: "Platform consolidation",
  kind: "initiative",
}

describe("fetchInitiatives", () => {
  it("issues exactly one query against strategic_initiatives", async () => {
    const { client, queries } = fakeSupabase({ data: [initiativeRow], error: null })
    await fetchInitiatives(client, "manager-1")
    expect(queries).toHaveLength(1)
    expect(queries[0].table).toBe("strategic_initiatives")
  })

  it("excludes areas", async () => {
    // The whole point of the task. Without this, every area the manager
    // captures on the map also appears in their strategy list.
    const { client, queries } = fakeSupabase({ data: [], error: null })
    await fetchInitiatives(client, "manager-1")
    expect(queries[0].filters).toContainEqual({ column: "kind", value: "initiative" })
  })

  it("scopes to the caller", async () => {
    const { client, queries } = fakeSupabase({ data: [], error: null })
    await fetchInitiatives(client, "manager-1")
    expect(queries[0].filters).toContainEqual({
      column: "manager_id",
      value: "manager-1",
    })
  })

  it("preserves the existing depth-then-creation ordering", async () => {
    // Unchanged from the page's original inline query. Reordering here would
    // silently rearrange a screen the manager already knows.
    const { client, queries } = fakeSupabase({ data: [], error: null })
    await fetchInitiatives(client, "manager-1")
    expect(queries[0].orders).toEqual([
      { column: "depth", ascending: true },
      { column: "created_at", ascending: true },
    ])
  })

  it("returns the rows on success", async () => {
    const { client } = fakeSupabase({ data: [initiativeRow], error: null })
    expect(await fetchInitiatives(client, "manager-1")).toHaveLength(1)
  })

  it("returns an empty list when the query fails", async () => {
    // Matches the behaviour the page already had: `const { data } = ...` then
    // `data ?? []`. Changing /initiatives' error handling is not this task's
    // job, and doing it quietly would be a behaviour change nobody asked for.
    const { client } = fakeSupabase({ data: null, error: { message: "boom" } })
    expect(await fetchInitiatives(client, "manager-1")).toEqual([])
  })
})

describe("fetchInitiativeChildren", () => {
  it("excludes areas from an initiative's children", async () => {
    // Nothing in the schema stops an area being parented under an initiative.
    // Without this filter such a row would render inside the initiatives
    // editor, which is the same bleed in the opposite direction.
    const { client, queries } = fakeSupabase({ data: [], error: null })
    await fetchInitiativeChildren(client, "init-1")
    expect(queries[0].filters).toContainEqual({ column: "kind", value: "initiative" })
  })

  it("filters to the given parent", async () => {
    const { client, queries } = fakeSupabase({ data: [], error: null })
    await fetchInitiativeChildren(client, "init-1")
    expect(queries[0].filters).toContainEqual({ column: "parent_id", value: "init-1" })
  })

  it("issues exactly one query", async () => {
    const { client, queries } = fakeSupabase({ data: [], error: null })
    await fetchInitiativeChildren(client, "init-1")
    expect(queries).toHaveLength(1)
  })

  it("returns an empty list when the query fails", async () => {
    const { client } = fakeSupabase({ data: null, error: { message: "boom" } })
    expect(await fetchInitiativeChildren(client, "init-1")).toEqual([])
  })
})
