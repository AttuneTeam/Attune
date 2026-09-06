import { assertIsolated } from "./isolation";
import { createTenant, isStackAvailable, SKIP_MESSAGE, type Tenant } from "./harness";

const suite = isStackAvailable() ? describe : describe.skip;
if (!isStackAvailable()) console.warn(SKIP_MESSAGE);

/**
 * interactions is isolated directly (manager_id = auth.uid()).
 *
 * action_items and embeddings are isolated INDIRECTLY, via an EXISTS join back
 * to the owning interaction. Indirect policies are where isolation bugs hide:
 * the row itself carries no owner column, so a mistake in the join silently
 * exposes every tenant's data.
 */
suite("tenant isolation: interaction-scoped tables", () => {
  let a: Tenant;
  let b: Tenant;

  beforeAll(async () => {
    a = await createTenant("int-a");
    b = await createTenant("int-b");
  });

  afterAll(async () => {
    await a?.destroy();
    await b?.destroy();
  });

  it("isolates interactions", async () => {
    await assertIsolated(a, b, {
      table: "interactions",
      mutableColumn: "ai_summary",
      ownRow: (t) => ({ manager_id: t.userId, participant_id: t.seed.memberId }),
      foreignRow: (v) => ({ manager_id: v.userId, participant_id: v.seed.memberId }),
      victimRowId: (v) => v.seed.interactionId,
      ownRowId: (t) => t.seed.interactionId,
    });
  });

  it("isolates action_items through the interaction join", async () => {
    await assertIsolated(a, b, {
      table: "action_items",
      mutableColumn: "description",
      ownRow: (t) => ({
        interaction_id: t.seed.interactionId,
        user_id: t.userId,
        description: "own action item",
      }),
      foreignRow: (v) => ({
        interaction_id: v.seed.interactionId,
        user_id: v.userId,
        description: "stolen action item",
      }),
      victimRowId: (v) => v.seed.actionItemId,
      ownRowId: (t) => t.seed.actionItemId,
    });
  });

  it("isolates embeddings through the interaction join", async () => {
    // Seeded here rather than in the harness: embeddings are only created by the
    // AI pipeline, so they are not part of a manager's baseline data.
    const seedEmbedding = async (t: Tenant): Promise<string> => {
      const { data, error } = await t.client
        .from("embeddings")
        .insert({ interaction_id: t.seed.interactionId, content: `chunk for ${t.label}` })
        .select("id")
        .single();
      if (error) throw new Error(`seeding embeddings failed: ${error.message}`);
      return (data as { id: string }).id;
    };

    const aEmbeddingId = await seedEmbedding(a);
    const bEmbeddingId = await seedEmbedding(b);

    await assertIsolated(a, b, {
      table: "embeddings",
      mutableColumn: "content",
      ownRow: (t) => ({ interaction_id: t.seed.interactionId, content: "own chunk" }),
      foreignRow: (v) => ({ interaction_id: v.seed.interactionId, content: "stolen chunk" }),
      victimRowId: () => bEmbeddingId,
      ownRowId: () => aEmbeddingId,
    });
  });

  it("hides another manager's PERSONAL action items (interaction_id IS NULL)", async () => {
    // Migration 034 unified personal todos into action_items with a NULL
    // interaction_id, guarded by a separate clause in the policy. That clause is
    // a distinct code path from the EXISTS join and needs its own assertion.
    const { data: personal, error: insertError } = await b.client
      .from("action_items")
      .insert({ user_id: b.userId, description: "B's private todo" })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    const personalId = (personal as { id: string }).id;

    const seen = await a.client.from("action_items").select("id").eq("id", personalId);
    expect(seen.error).toBeNull();
    expect(
      seen.data,
      "LEAK — one manager can read another manager's personal action items",
    ).toEqual([]);

    // And cannot create one attributed to the other manager.
    const forged = await a.client
      .from("action_items")
      .insert({ user_id: b.userId, description: "forged personal todo" })
      .select("id");
    expect(forged.error?.code, "LEAK — a personal action item can be forged").toBe("42501");
  });
});
