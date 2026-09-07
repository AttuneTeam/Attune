import { createArea, deleteArea, updateArea } from "./api"

/**
 * The client side of the area endpoints.
 *
 * Everything here is about the failure paths. product-guidelines.md UX
 * principle 7 requires the map to fail quietly and honestly, and that is only
 * possible if every call returns a usable message instead of throwing —
 * including when the network drops, when the server answers with HTML, and
 * when it answers with nothing at all.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("createArea", () => {
  it("posts the input and returns the new id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "area-9" }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await createArea({ title: "Agency handover", domain: "Platform" })
    expect(result).toEqual({ ok: true, id: "area-9" })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/map/areas")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({
      title: "Agency handover",
      domain: "Platform",
    })
  })

  it("omits keys that were not supplied", async () => {
    // The schema is strict, so sending domain: undefined as an explicit null
    // would change the meaning of the request.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "a" }))
    vi.stubGlobal("fetch", fetchMock)
    await createArea({ title: "a" })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ title: "a" })
  })

  it("returns the server's message on a rejected request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "An area needs a title." }, 400)),
    )
    const result = await createArea({ title: "" })
    expect(result).toEqual({ ok: false, message: "An area needs a title." })
  })

  it("falls back to a plain message when the error body is not JSON", async () => {
    // A 502 from a proxy answers with HTML. Parsing that must not throw.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 })),
    )
    const result = await createArea({ title: "a" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBeTruthy()
    expect(result.message).not.toContain("<html>")
  })

  it("returns a message when the network fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
    const result = await createArea({ title: "a" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBeTruthy()
  })
})

describe("updateArea", () => {
  it("patches the given fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    expect(await updateArea("area-1", { confidence: "owned" })).toEqual({ ok: true })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/map/areas/area-1")
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(init.body)).toEqual({ confidence: "owned" })
  })

  it("sends a review-only touch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)
    await updateArea("area-1", { reviewed: true })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ reviewed: true })
  })

  it("reports a 404 as a failure with a message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Area not found." }, 404)),
    )
    const result = await updateArea("gone", { confidence: "aware" })
    expect(result).toEqual({ ok: false, message: "Area not found." })
  })
})

describe("deleteArea", () => {
  it("deletes by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    expect(await deleteArea("area-1")).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/map/areas/area-1")
    expect(init.method).toBe("DELETE")
  })

  it("reports a failure with a message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, 500)))
    expect(await deleteArea("area-1")).toEqual({ ok: false, message: "boom" })
  })
})
