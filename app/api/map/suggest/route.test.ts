import { NextRequest } from "next/server"
import { fakeSupabase, type FakeSupabase, type QueryResult } from "@/lib/test-utils/fakeSupabase"

/**
 * The brain dump's endpoint.
 *
 * The property that matters most is negative: this route writes nothing. FR4
 * requires that nothing reaches the database until the manager has looked at
 * the proposal and accepted it, and "AI is offered, never imposed" is a product
 * principle rather than a preference. A test asserts no insert, update or
 * delete is issued at all.
 */

const hoisted = vi.hoisted(() => ({
  client: null as unknown,
  generate: null as unknown,
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => hoisted.client }))
// The real model is never called from a test.
vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) =>
    (hoisted.generate as (...a: unknown[]) => unknown)(...args),
}))
vi.mock("@ai-sdk/openai", () => ({ openai: (id: string) => ({ id }) }))

const { POST } = await import("./route")

function setup(
  result: QueryResult,
  generate: (...args: unknown[]) => unknown,
  user?: { id: string } | null,
): FakeSupabase {
  const fake = fakeSupabase(result, { user })
  hoisted.client = fake.client
  hoisted.generate = generate
  return fake
}

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/map/suggest", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const domains: QueryResult = { data: [{ name: "Platform" }, { name: "People" }], error: null }
const proposal = {
  object: { areas: [{ title: "Agency handover", domain: "Platform" }] },
}
const DUMP =
  "the agency still owns deploys and I need to hire two seniors before the end of the quarter"

describe("POST /api/map/suggest", () => {
  it("rejects an unauthenticated request", async () => {
    setup(domains, () => proposal, null)
    expect((await POST(post({ text: DUMP }))).status).toBe(401)
  })

  it("rejects an empty or trivially short dump", async () => {
    // Nothing useful comes out of three words, and asking the model anyway
    // invites it to invent something to justify the call.
    setup(domains, () => proposal)
    expect((await POST(post({ text: "" }))).status).toBe(400)
    expect((await POST(post({ text: "hire people" }))).status).toBe(400)
    expect((await POST(post({}))).status).toBe(400)
    expect((await POST(post("not json"))).status).toBe(400)
  })

  it("returns the proposal", async () => {
    setup(domains, () => proposal)
    const res = await POST(post({ text: DUMP }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      areas: [{ title: "Agency handover", domain: "Platform" }],
    })
  })

  it("writes nothing to the database", async () => {
    // FR4. Nothing reaches storage until the manager accepts.
    const fake = setup(domains, () => proposal)
    await POST(post({ text: DUMP }))
    const writes = fake.queries.filter((q) => q.op !== "select")
    expect(writes, "the suggestion route wrote to the database").toEqual([])
  })

  it("passes the manager's existing domains to the model", async () => {
    // So it reuses "Platform" rather than coining "Tech" beside it.
    let seenPrompt = ""
    const fake = setup(domains, (args: unknown) => {
      seenPrompt = (args as { prompt: string }).prompt
      return proposal
    })
    await POST(post({ text: DUMP }))
    expect(fake.queries[0].table).toBe("map_domains")
    expect(seenPrompt).toContain("Platform")
    expect(seenPrompt).toContain(DUMP)
  })

  it("rejects a malformed response from the model rather than passing it on", async () => {
    setup(domains, () => ({ object: { areas: [{ title: "", domain: 7 }] } }))
    const res = await POST(post({ text: DUMP }))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBeTruthy()
  })

  it("reports a model failure plainly", async () => {
    setup(domains, () => {
      throw new Error("upstream exploded")
    })
    const res = await POST(post({ text: DUMP }))
    expect(res.status).toBe(502)
    // The upstream message is not shown to the manager.
    expect((await res.json()).error).not.toContain("exploded")
  })
})
