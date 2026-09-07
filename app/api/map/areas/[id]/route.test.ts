import { NextRequest } from "next/server"
import { fakeSupabase, type FakeSupabase, type QueryResult } from "@/lib/test-utils/fakeSupabase"

/**
 * Updating and removing an area.
 *
 * Every write is filtered by id AND manager_id AND kind='area'. RLS already
 * enforces the tenancy half, but stating it here means a policy regression
 * cannot silently widen these endpoints, and the kind filter stops the map's
 * endpoints being used to edit strategic initiatives.
 */

const hoisted = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => hoisted.client,
}))

const { PATCH, DELETE } = await import("./route")

const AREA_ID = "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60"
const params = Promise.resolve({ id: AREA_ID })

function setup(results: QueryResult | QueryResult[], user?: { id: string } | null): FakeSupabase {
  const fake = fakeSupabase(results, { user })
  hoisted.client = fake.client
  return fake
}

function patch(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/map/areas/${AREA_ID}`, {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function del(): NextRequest {
  return new NextRequest(`http://localhost/api/map/areas/${AREA_ID}`, { method: "DELETE" })
}

const touched: QueryResult = { data: [{ id: AREA_ID }], error: null }
const nothing: QueryResult = { data: [], error: null }

describe("PATCH /api/map/areas/[id]", () => {
  it("rejects an unauthenticated request", async () => {
    setup(touched, null)
    expect((await PATCH(patch({ confidence: "aware" }), { params })).status).toBe(401)
  })

  it("rejects an empty body", async () => {
    setup(touched)
    expect((await PATCH(patch({}), { params })).status).toBe(400)
  })

  it("rejects an unrecognised confidence", async () => {
    setup(touched)
    expect((await PATCH(patch({ confidence: "quite sure" }), { params })).status).toBe(400)
  })

  it("refuses client-supplied server-owned fields", async () => {
    setup(touched)
    expect((await PATCH(patch({ manager_id: AREA_ID }), { params })).status).toBe(400)
    expect((await PATCH(patch({ kind: "initiative" }), { params })).status).toBe(400)
    expect((await PATCH(patch({ last_reviewed_at: "2020-01-01" }), { params })).status).toBe(400)
  })

  it("scopes the write to the caller's own area", async () => {
    const fake = setup(touched)
    await PATCH(patch({ confidence: "understood" }), { params })
    expect(fake.queries).toHaveLength(1)
    expect(fake.queries[0].op).toBe("update")
    expect(fake.queries[0].filters).toEqual([
      { column: "id", value: AREA_ID },
      { column: "manager_id", value: "manager-1" },
      { column: "kind", value: "area" },
    ])
  })

  it("stamps the review time when confidence changes", async () => {
    const fake = setup(touched)
    await PATCH(patch({ confidence: "owned" }), { params })
    const payload = fake.queries[0].payload as Record<string, unknown>
    expect(payload.confidence).toBe("owned")
    expect(typeof payload.last_reviewed_at).toBe("string")
  })

  it("stamps the review time alone for a review-only touch", async () => {
    const fake = setup(touched)
    await PATCH(patch({ reviewed: true }), { params })
    const payload = fake.queries[0].payload as Record<string, unknown>
    expect(Object.keys(payload)).toEqual(["last_reviewed_at"])
  })

  it("does not stamp a review for a rename", async () => {
    // Tidying up titles must not reset the staleness clock across the map.
    const fake = setup(touched)
    await PATCH(patch({ title: "Renamed" }), { params })
    expect(fake.queries[0].payload).toEqual({ title: "Renamed" })
  })

  it("404s when the row is not the caller's or is not an area", async () => {
    // RLS narrows the row set silently rather than erroring, so zero rows
    // affected is the only signal available.
    setup(nothing)
    expect((await PATCH(patch({ confidence: "aware" }), { params })).status).toBe(404)
  })

  it("surfaces a write failure", async () => {
    setup({ data: null, error: { message: "boom" } })
    expect((await PATCH(patch({ confidence: "aware" }), { params })).status).toBe(500)
  })
})

describe("DELETE /api/map/areas/[id]", () => {
  it("rejects an unauthenticated request", async () => {
    setup(touched, null)
    expect((await DELETE(del(), { params })).status).toBe(401)
  })

  it("scopes the delete to the caller's own area", async () => {
    const fake = setup(touched)
    const res = await DELETE(del(), { params })
    expect(res.status).toBe(200)
    expect(fake.queries[0].op).toBe("delete")
    expect(fake.queries[0].filters).toEqual([
      { column: "id", value: AREA_ID },
      { column: "manager_id", value: "manager-1" },
      { column: "kind", value: "area" },
    ])
  })

  it("404s when the row is not the caller's or is not an area", async () => {
    setup(nothing)
    expect((await DELETE(del(), { params })).status).toBe(404)
  })

  it("surfaces a delete failure", async () => {
    setup({ data: null, error: { message: "boom" } })
    expect((await DELETE(del(), { params })).status).toBe(500)
  })
})
