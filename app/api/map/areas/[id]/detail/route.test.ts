import { NextRequest } from "next/server"
import { fakeSupabase, type FakeSupabase, type QueryResult } from "@/lib/test-utils/fakeSupabase"

/**
 * Everything the detail panel needs, in one request.
 *
 * The list query deliberately omits `description` — a Tiptap document per row
 * would move kilobytes across the whole map for something only this panel
 * reads. So the panel fetches it on open, together with the linked
 * conversations, rather than making two round trips from the browser.
 */

const hoisted = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => hoisted.client }))
const { GET } = await import("./route")

const ID = "6f1c9b34-4a2e-4c8f-9d21-1b2c3d4e5f60"
const params = Promise.resolve({ id: ID })

function setup(results: QueryResult | QueryResult[], user?: { id: string } | null): FakeSupabase {
  const fake = fakeSupabase(results, { user })
  hoisted.client = fake.client
  return fake
}
const req = () => new NextRequest(`http://localhost/api/map/areas/${ID}/detail`)

const area: QueryResult = { data: { description: { type: "doc" } }, error: null }
const noSignals: QueryResult = { data: [], error: null }

describe("GET /api/map/areas/[id]/detail", () => {
  it("rejects an unauthenticated request", async () => {
    setup(area, null)
    expect((await GET(req(), { params })).status).toBe(401)
  })

  it("scopes the area to the caller and to areas", async () => {
    const fake = setup([area, noSignals])
    const res = await GET(req(), { params })
    expect(res.status).toBe(200)
    expect(fake.queries[0].filters).toEqual([
      { column: "id", value: ID },
      { column: "manager_id", value: "manager-1" },
      { column: "kind", value: "area" },
    ])
  })

  it("returns the notes and the linked conversations together", async () => {
    const fake = setup([area, noSignals])
    const body = await (await GET(req(), { params })).json()
    expect(body).toEqual({ description: { type: "doc" }, linked: [] })
    // One round trip from the browser, two queries on the server.
    expect(fake.queries).toHaveLength(2)
  })

  it("404s for an area that is not the caller's", async () => {
    setup([{ data: null, error: null }])
    expect((await GET(req(), { params })).status).toBe(404)
  })
})
