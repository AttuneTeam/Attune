import { NextRequest } from "next/server"
import { fakeSupabase, type FakeSupabase, type QueryResult } from "@/lib/test-utils/fakeSupabase"

const hoisted = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => hoisted.client }))
const { POST } = await import("./route")

const ID = "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60"
const params = Promise.resolve({ id: ID })

function setup(result: QueryResult, user?: { id: string } | null): FakeSupabase {
  const fake = fakeSupabase(result, { user })
  hoisted.client = fake.client
  return fake
}
function post(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/map/domains/${ID}/move`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}
const moved: QueryResult = { data: null, error: null }

describe("POST /api/map/domains/[id]/move", () => {
  it("rejects an unauthenticated request", async () => {
    setup(moved, null)
    expect((await POST(post({ direction: "up" }), { params })).status).toBe(401)
  })

  it("rejects a direction it does not recognise", async () => {
    setup(moved)
    expect((await POST(post({ direction: "sideways" }), { params })).status).toBe(400)
  })

  it("calls the swap function", async () => {
    const fake = setup(moved)
    expect((await POST(post({ direction: "down" }), { params })).status).toBe(200)
    expect(fake.rpcs).toEqual([
      { fn: "move_domain", args: { p_domain_id: ID, p_direction: "down" } },
    ])
  })

  it("reports a domain it cannot see as missing, not a server error", async () => {
    setup({ data: null, error: { message: "Domain not found", code: "42501" } })
    expect((await POST(post({ direction: "up" }), { params })).status).toBe(404)
  })
})
