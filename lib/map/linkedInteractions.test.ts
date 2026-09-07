import { fakeSupabase } from "@/lib/test-utils/fakeSupabase"
import { LINKED_INTERACTION_SELECT, fetchLinkedInteractions } from "./linkedInteractions"

/**
 * The conversations that touched an area.
 *
 * This is the join that makes the map Attune's rather than a generic outline:
 * migration 040 already records whether a 1-on-1 advanced, reinforced or
 * threatened an initiative, and an area is a row in the same table. Nothing
 * new is captured here — it is context the manager's own notes already produced.
 */

const ROW = {
  signal: "threatens",
  note: "handover date slipped",
  created_at: "2026-09-02T09:00:00.000Z",
  interaction: {
    id: "int-1",
    title: "1-on-1 with Sam",
    scheduled_at: "2026-09-02T09:00:00.000Z",
    participant: { id: "member-1", name: "Sam Okafor" },
  },
}

describe("LINKED_INTERACTION_SELECT", () => {
  it("resolves the interaction and its participant in the same query", () => {
    // A name fetched per signal would be an N+1 inside a panel the manager
    // opens constantly.
    expect(LINKED_INTERACTION_SELECT).toContain("interaction:interactions")
    expect(LINKED_INTERACTION_SELECT).toContain("participant:team_members")
  })
})

describe("fetchLinkedInteractions", () => {
  it("issues one query against the signals table", async () => {
    const { client, queries } = fakeSupabase({ data: [ROW], error: null })
    await fetchLinkedInteractions(client, "area-1", "manager-1")
    expect(queries).toHaveLength(1)
    expect(queries[0].table).toBe("interaction_initiative_signals")
  })

  it("scopes to the area and the caller", async () => {
    const { client, queries } = fakeSupabase({ data: [], error: null })
    await fetchLinkedInteractions(client, "area-1", "manager-1")
    expect(queries[0].filters).toEqual([
      { column: "initiative_id", value: "area-1" },
      { column: "manager_id", value: "manager-1" },
    ])
  })

  it("puts the most recent conversation first", async () => {
    // The panel is read top-down when preparing for a conversation, so the
    // freshest signal has to be the one in view.
    const { client, queries } = fakeSupabase({ data: [], error: null })
    await fetchLinkedInteractions(client, "area-1", "manager-1")
    expect(queries[0].orders).toEqual([{ column: "created_at", ascending: false }])
  })

  it("flattens a row into something the panel can render", async () => {
    const { client } = fakeSupabase({ data: [ROW], error: null })
    const linked = await fetchLinkedInteractions(client, "area-1", "manager-1")
    expect(linked).toEqual([
      {
        interactionId: "int-1",
        title: "1-on-1 with Sam",
        participantName: "Sam Okafor",
        signal: "threatens",
        note: "handover date slipped",
        occurredAt: "2026-09-02T09:00:00.000Z",
      },
    ])
  })

  it("normalises embeds returned as arrays", async () => {
    // PostgREST returns a to-one embed as an object, but falls back to an array
    // when it cannot infer cardinality. One shape must reach the component.
    const { client } = fakeSupabase({
      data: [{ ...ROW, interaction: [{ ...ROW.interaction, participant: [ROW.interaction.participant] }] }],
      error: null,
    })
    const linked = await fetchLinkedInteractions(client, "area-1", "manager-1")
    expect(linked[0].interactionId).toBe("int-1")
    expect(linked[0].participantName).toBe("Sam Okafor")
  })

  it("survives a signal whose interaction has been deleted", async () => {
    // The row is meaningless without its conversation, and rendering a link to
    // nothing would be worse than omitting it.
    const { client } = fakeSupabase({ data: [{ ...ROW, interaction: null }], error: null })
    expect(await fetchLinkedInteractions(client, "area-1", "manager-1")).toEqual([])
  })

  it("copes with an interaction that has no participant or title", async () => {
    const { client } = fakeSupabase({
      data: [{ ...ROW, interaction: { id: "int-2", title: null, scheduled_at: null, participant: null } }],
      error: null,
    })
    const linked = await fetchLinkedInteractions(client, "area-1", "manager-1")
    expect(linked[0].interactionId).toBe("int-2")
    expect(linked[0].title).toBeNull()
    expect(linked[0].participantName).toBeNull()
  })

  it("returns an empty list rather than throwing when nothing is linked", async () => {
    // The common case for a new area. An empty panel section is a fine answer.
    const { client } = fakeSupabase({ data: [], error: null })
    expect(await fetchLinkedInteractions(client, "area-1", "manager-1")).toEqual([])
  })

  it("returns an empty list when the query fails", async () => {
    // Context is additive. Losing it must not stop the manager reading or
    // editing the area itself.
    const { client } = fakeSupabase({ data: null, error: { message: "boom" } })
    expect(await fetchLinkedInteractions(client, "area-1", "manager-1")).toEqual([])
  })
})
