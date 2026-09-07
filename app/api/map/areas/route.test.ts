import { NextRequest } from "next/server"
import { fakeSupabase, type FakeSupabase, type QueryResult } from "@/lib/test-utils/fakeSupabase"

/**
 * Creating an area.
 *
 * The assertions that matter are about what the server refuses to take from
 * the client. manager_id comes from the session and nowhere else, kind is
 * forced, and depth is derived from the parent — those three are the tenancy
 * boundary and the area/initiative split, and a client must not be able to
 * influence any of them.
 */

const hoisted = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => hoisted.client,
}))

const { POST } = await import("./route")

const VALID_UUID = "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60"

function setup(results: QueryResult | QueryResult[], user?: { id: string } | null): FakeSupabase {
  const fake = fakeSupabase(results, { user })
  hoisted.client = fake.client
  return fake
}

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/map/areas", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const created: QueryResult = { data: { id: "new-area" }, error: null }

describe("POST /api/map/areas", () => {
  it("rejects an unauthenticated request", async () => {
    setup(created, null)
    const res = await POST(post({ title: "Agency handover" }))
    expect(res.status).toBe(401)
  })

  it("rejects a body that is not JSON", async () => {
    // A thrown SyntaxError here would surface as a 500, which reads as our bug
    // rather than the caller's.
    setup(created)
    const res = await POST(post("not json at all"))
    expect(res.status).toBe(400)
  })

  it("rejects a missing title", async () => {
    setup(created)
    expect((await POST(post({}))).status).toBe(400)
    expect((await POST(post({ title: "   " }))).status).toBe(400)
  })

  it("refuses a client-supplied kind or manager_id", async () => {
    // The strict schema turns an attempt to cross the tenancy boundary, or to
    // create an initiative through the map's endpoint, into a loud 400.
    setup(created)
    expect((await POST(post({ title: "a", kind: "initiative" }))).status).toBe(400)
    expect((await POST(post({ title: "a", manager_id: VALID_UUID }))).status).toBe(400)
    expect((await POST(post({ title: "a", depth: 2 }))).status).toBe(400)
  })

  it("forces kind to area and takes manager_id from the session", async () => {
    const fake = setup(created)
    const res = await POST(post({ title: "Agency handover", domain: "Platform" }))
    expect(res.status).toBe(200)

    expect(fake.queries).toHaveLength(1)
    const insert = fake.queries[0]
    expect(insert.op).toBe("insert")
    expect(insert.table).toBe("strategic_initiatives")
    expect(insert.payload).toEqual({
      manager_id: "manager-1",
      kind: "area",
      title: "Agency handover",
      domain: "Platform",
      parent_id: null,
      depth: 0,
    })
  })

  it("treats a blank domain as ungrouped", async () => {
    const fake = setup(created)
    await POST(post({ title: "a", domain: "  " }))
    expect((fake.queries[0].payload as { domain: unknown }).domain).toBeNull()
  })

  it("derives depth from the parent", async () => {
    const parent: QueryResult = { data: { depth: 1, kind: "area" }, error: null }
    const fake = setup([parent, created])
    const res = await POST(post({ title: "Refunds", parent_id: VALID_UUID }))
    expect(res.status).toBe(200)

    // The parent lookup must be scoped to the caller: without the manager_id
    // filter a client could discover another tenant's depth values.
    expect(fake.queries[0].filters).toEqual([
      { column: "id", value: VALID_UUID },
      { column: "manager_id", value: "manager-1" },
    ])
    expect((fake.queries[1].payload as { depth: unknown }).depth).toBe(2)
  })

  it("404s when the parent is not the caller's", async () => {
    setup([{ data: null, error: null }])
    const res = await POST(post({ title: "a", parent_id: VALID_UUID }))
    expect(res.status).toBe(404)
  })

  it("refuses to nest beyond depth 2", async () => {
    setup([{ data: { depth: 2, kind: "area" }, error: null }])
    const res = await POST(post({ title: "a", parent_id: VALID_UUID }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/deep/i)
  })

  it("refuses to nest an area under an initiative", async () => {
    // The schema permits it -- nothing in the database stops it -- but an area
    // hanging off an initiative appears in neither lens correctly.
    setup([{ data: { depth: 0, kind: "initiative" }, error: null }])
    const res = await POST(post({ title: "a", parent_id: VALID_UUID }))
    expect(res.status).toBe(400)
  })

  it("surfaces a write failure rather than reporting success", async () => {
    setup({ data: null, error: { message: "constraint violated" } })
    const res = await POST(post({ title: "a" }))
    expect(res.status).toBe(500)
  })
})
