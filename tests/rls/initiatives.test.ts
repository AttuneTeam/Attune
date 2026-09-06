import { assertMutuallyIsolated } from "./isolation";
import { createTenant, isStackAvailable, SKIP_MESSAGE, type Tenant } from "./harness";

const suite = isStackAvailable() ? describe : describe.skip;
if (!isStackAvailable()) console.warn(SKIP_MESSAGE);

suite("tenant isolation: strategic_initiatives", () => {
  let a: Tenant;
  let b: Tenant;

  beforeAll(async () => {
    a = await createTenant("init-a");
    b = await createTenant("init-b");
  });

  afterAll(async () => {
    await a?.destroy();
    await b?.destroy();
  });

  it("isolates strategic_initiatives", async () => {
    await assertMutuallyIsolated(a, b, {
      table: "strategic_initiatives",
      mutableColumn: "title",
      ownRow: (t) => ({ manager_id: t.userId, title: "own initiative" }),
      foreignRow: (v) => ({ manager_id: v.userId, title: "stolen initiative" }),
      victimRowId: (v) => v.seed.initiativeId,
      ownRowId: (t) => t.seed.initiativeId,
    });
  });

  it("isolates nested child initiatives", async () => {
    // Migration 033 added parent_id/depth. A child row is reached by the same
    // manager_id policy as its parent, but nesting is a distinct shape worth
    // asserting directly.
    const { data: child, error } = await b.client
      .from("strategic_initiatives")
      .insert({
        manager_id: b.userId,
        title: "B's child initiative",
        parent_id: b.seed.initiativeId,
        depth: 1,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    const childId = (child as { id: string }).id;

    const seen = await a.client
      .from("strategic_initiatives")
      .select("id")
      .eq("id", childId);
    expect(seen.error).toBeNull();
    expect(
      seen.data,
      "LEAK — one manager can read another manager's nested child initiative",
    ).toEqual([]);

    // A must not be able to read the whole tree by querying on the parent id.
    const byParent = await a.client
      .from("strategic_initiatives")
      .select("id")
      .eq("parent_id", b.seed.initiativeId);
    expect(
      byParent.data,
      "LEAK — another manager's initiative tree is readable by parent_id",
    ).toEqual([]);
  });

  it("documents cross-tenant parent_id attachment", async () => {
    // The policy checks only manager_id, so nothing stops A from creating a row
    // they own whose parent_id points into B's tree. This is NOT a data leak —
    // A still cannot read B's rows, and B's own queries filter by manager_id so
    // the foreign child never appears to them.
    //
    // It is, however, a cross-tenant integrity coupling: because parent_id is
    // ON DELETE CASCADE, B deleting their initiative would silently delete A's
    // row. Asserted here so the behaviour is recorded and any future change to
    // it is deliberate rather than accidental.
    const attached = await a.client
      .from("strategic_initiatives")
      .insert({
        manager_id: a.userId,
        title: "A's row parented into B's tree",
        parent_id: b.seed.initiativeId,
        depth: 1,
      })
      .select("id")
      .single();

    expect(
      attached.error,
      "parent_id now rejects cross-tenant references — update this test and the finding it documents",
    ).toBeNull();

    // Confirm the important part: this grants A no read access to B's data.
    const parent = await a.client
      .from("strategic_initiatives")
      .select("id")
      .eq("id", b.seed.initiativeId);
    expect(
      parent.data,
      "LEAK — parenting into another tenant's tree exposed the parent row",
    ).toEqual([]);
  });
});
