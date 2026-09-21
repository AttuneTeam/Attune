import { NextRequest } from "next/server"
import { fakeSupabase, type FakeSupabase, type QueryResult } from "@/lib/test-utils/fakeSupabase"

/**
 * Reordering an area within its group.
 *
 * The swap itself lives in a database function so it happens in one
 * transaction (migration 043). This route's job is the auth guard, validating
 * the direction, and turning the function's SQLSTATEs into honest HTTP codes —
 * a refusal caused by Row-Level Security must not surface as a 500, which would
 * read as our fault rather than a missing row.
 */

const hoisted = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => hoisted.client,
}))

const { POST } = await import("./route")

const AREA_ID = "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60"
const params = Promise.resolve({ id: AREA_ID })

function setup(result: QueryResult, user?: { id: string } | null): FakeSupabase {
  const fake = fakeSupabase(result, { user })
  hoisted.client = fake.client
  return fake
}

function move(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/map/areas/${AREA_ID}/move`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const moved: QueryResult = { data: null, error: null }

describe("POST /api/map/areas/[id]/move", () => {
  it("rejects an unauthenticated request", async () => {
    setup(moved, null)
    expect((await POST(move({ direction: "up" }), { params })).status).toBe(401)
  })

  it("rejects a direction it does not recognise", async () => {
    setup(moved)
    expect((await POST(move({ direction: "sideways" }), { params })).status).toBe(400)
    expect((await POST(move({}), { params })).status).toBe(400)
    expect((await POST(move("not json"), { params })).status).toBe(400)
  })

  it("refuses an absolute position", async () => {
    // Letting a client post a number invites two of them writing the same one.
    setup(moved)
    expect((await POST(move({ sort_order: 3 }), { params })).status).toBe(400)
  })

  it("calls the swap function with the area and direction", async () => {
    const fake = setup(moved)
    const res = await POST(move({ direction: "down" }), { params })
    expect(res.status).toBe(200)
    expect(fake.rpcs).toEqual([
      { fn: "move_area", args: { p_area_id: AREA_ID, p_direction: "down" } },
    ])
  })

  it("reports a row it cannot see as missing, not as a server error", async () => {
    // move_area runs as the caller, so an area belonging to another manager is
    // simply invisible and the function raises insufficient_privilege. That is
    // a 404 to the client -- a 500 would blame us for their bad request.
    setup({ data: null, error: { message: "Area not found", code: "42501" } })
    const res = await POST(move({ direction: "up" }), { params })
    expect(res.status).toBe(404)
  })

  it("reports an invalid direction from the function as a 400", async () => {
    setup({ data: null, error: { message: "Direction must be up or down", code: "22023" } })
    expect((await POST(move({ direction: "up" }), { params })).status).toBe(400)
  })

  it("surfaces anything else as a server error", async () => {
    setup({ data: null, error: { message: "deadlock detected", code: "40P01" } })
    expect((await POST(move({ direction: "up" }), { params })).status).toBe(500)
  })
})
