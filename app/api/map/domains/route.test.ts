import { NextRequest } from "next/server"
import { fakeSupabase, type FakeSupabase, type QueryResult } from "@/lib/test-utils/fakeSupabase"

const hoisted = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => hoisted.client }))
const { POST } = await import("./route")

function setup(results: QueryResult | QueryResult[], user?: { id: string } | null): FakeSupabase {
  const fake = fakeSupabase(results, { user })
  hoisted.client = fake.client
  return fake
}
function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/map/domains", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}
const created: QueryResult = { data: { id: "dom-1", name: "Platform" }, error: null }

describe("POST /api/map/domains", () => {
  it("rejects an unauthenticated request", async () => {
    setup(created, null)
    expect((await POST(post({ name: "Platform" }))).status).toBe(401)
  })

  it("rejects a blank name", async () => {
    setup(created)
    expect((await POST(post({ name: "   " }))).status).toBe(400)
    expect((await POST(post({}))).status).toBe(400)
  })

  it("takes manager_id from the session, never the body", async () => {
    setup(created)
    expect((await POST(post({ name: "a", manager_id: "someone-else" }))).status).toBe(400)
  })

  it("creates the domain for the caller", async () => {
    const fake = setup(created)
    const res = await POST(post({ name: "  Platform  " }))
    expect(res.status).toBe(200)
    expect(fake.queries[0].table).toBe("map_domains")
    expect(fake.queries[0].payload).toEqual({ manager_id: "manager-1", name: "Platform" })
  })

  it("reports a duplicate name as a conflict, not a server error", async () => {
    // 23505 is unique_violation. The manager already has this domain; that is
    // their situation to fix, not our fault.
    setup({ data: null, error: { message: "duplicate key", code: "23505" } })
    const res = await POST(post({ name: "Platform" }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already/i)
  })

  it("surfaces anything else as a server error", async () => {
    setup({ data: null, error: { message: "boom", code: "XX000" } })
    expect((await POST(post({ name: "a" }))).status).toBe(500)
  })
})
