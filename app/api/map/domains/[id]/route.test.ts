import { NextRequest } from "next/server"
import { fakeSupabase, type FakeSupabase, type QueryResult } from "@/lib/test-utils/fakeSupabase"

const hoisted = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => hoisted.client }))
const { PATCH, DELETE } = await import("./route")

const ID = "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60"
const params = Promise.resolve({ id: ID })

function setup(results: QueryResult | QueryResult[], user?: { id: string } | null): FakeSupabase {
  const fake = fakeSupabase(results, { user })
  hoisted.client = fake.client
  return fake
}
function req(method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/map/domains/${ID}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
const renamed: QueryResult = { data: [{ id: ID }], error: null }
const nothing: QueryResult = { data: [], error: null }

describe("PATCH /api/map/domains/[id]", () => {
  it("rejects an unauthenticated request", async () => {
    setup(renamed, null)
    expect((await PATCH(req("PATCH", { name: "New" }), { params })).status).toBe(401)
  })

  it("rejects a blank name", async () => {
    setup(renamed)
    expect((await PATCH(req("PATCH", { name: " " }), { params })).status).toBe(400)
  })

  it("renames the domain, scoped to the caller", async () => {
    const fake = setup([renamed, { data: null, error: null }])
    const res = await PATCH(req("PATCH", { name: "Delivery" }), { params })
    expect(res.status).toBe(200)
    expect(fake.queries[0].table).toBe("map_domains")
    expect(fake.queries[0].payload).toEqual({ name: "Delivery" })
    expect(fake.queries[0].filters).toEqual([
      { column: "id", value: ID },
      { column: "manager_id", value: "manager-1" },
    ])
  })

  it("keeps the retiring domain text column in step", async () => {
    // The text column is still live for one release (migration 044). Leaving it
    // stale would make a rename invisible to any code still reading it.
    const fake = setup([renamed, { data: null, error: null }])
    await PATCH(req("PATCH", { name: "Delivery" }), { params })
    expect(fake.queries).toHaveLength(2)
    expect(fake.queries[1].table).toBe("strategic_initiatives")
    expect(fake.queries[1].payload).toEqual({ domain: "Delivery" })
    expect(fake.queries[1].filters).toContainEqual({ column: "domain_id", value: ID })
  })

  it("404s when the domain is not the caller's", async () => {
    setup(nothing)
    expect((await PATCH(req("PATCH", { name: "x" }), { params })).status).toBe(404)
  })

  it("reports a duplicate name as a conflict", async () => {
    setup({ data: null, error: { message: "duplicate key", code: "23505" } })
    expect((await PATCH(req("PATCH", { name: "x" }), { params })).status).toBe(409)
  })
})

describe("DELETE /api/map/domains/[id]", () => {
  it("rejects an unauthenticated request", async () => {
    setup(renamed, null)
    expect((await DELETE(req("DELETE"), { params })).status).toBe(401)
  })

  it("ungroups the areas before removing the domain", async () => {
    // The order matters: clearing the text column has to happen while
    // domain_id still points at the domain. Afterwards the FK has already set
    // it to null and the rows are unfindable.
    const fake = setup([{ data: null, error: null }, renamed])
    const res = await DELETE(req("DELETE"), { params })
    expect(res.status).toBe(200)
    expect(fake.queries[0].table).toBe("strategic_initiatives")
    expect(fake.queries[0].payload).toEqual({ domain: null })
    expect(fake.queries[0].filters).toContainEqual({ column: "domain_id", value: ID })
    expect(fake.queries[1].table).toBe("map_domains")
    expect(fake.queries[1].op).toBe("delete")
  })

  it("404s when the domain is not the caller's", async () => {
    setup([{ data: null, error: null }, nothing])
    expect((await DELETE(req("DELETE"), { params })).status).toBe(404)
  })
})
