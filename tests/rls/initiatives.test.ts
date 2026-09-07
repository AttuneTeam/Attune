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

  it("rejects a parent_id owned by another manager", async () => {
    // parent_id is ON DELETE CASCADE, so a row parented into another manager's
    // tree is destroyed when that manager deletes their own row. The RLS policy
    // checks only manager_id and therefore cannot see this: A owns the child, so
    // the write is legitimately theirs to make.
    //
    // INSERT and UPDATE are the only two ways to create the coupling. Blocking
    // both is what makes cross-tenant cascade destruction impossible — there is
    // no third path by which A's row can come to hang off B's tree.

    const inserted = await a.client
      .from("strategic_initiatives")
      .insert({
        manager_id: a.userId,
        title: "A's row parented into B's tree",
        parent_id: b.seed.initiativeId,
        depth: 1,
      })
      .select("id");
    expect(
      inserted.error,
      "INTEGRITY — a row can still be INSERTed with a parent_id owned by another manager",
    ).not.toBeNull();
    expect(
      inserted.error?.code,
      `rejected, but by ${inserted.error?.code} rather than insufficient_privilege (42501)`,
    ).toBe("42501");

    // The UPDATE path: create a legitimate row, then try to re-parent it across
    // the tenant boundary.
    const own = await a.client
      .from("strategic_initiatives")
      .insert({ manager_id: a.userId, title: "A's own row" })
      .select("id")
      .single();
    expect(own.error).toBeNull();
    const ownId = (own.data as { id: string }).id;

    const updated = await a.client
      .from("strategic_initiatives")
      .update({ parent_id: b.seed.initiativeId, depth: 1 })
      .eq("id", ownId)
      .select("id");
    expect(
      updated.error,
      "INTEGRITY — an existing row can still be re-parented under another manager's row",
    ).not.toBeNull();
    expect(updated.error?.code).toBe("42501");

    // The row must be untouched, not partially written.
    const after = await a.client
      .from("strategic_initiatives")
      .select("parent_id")
      .eq("id", ownId)
      .single();
    expect((after.data as { parent_id: string | null }).parent_id).toBeNull();
  });

  it("still allows nesting and cascading within a manager's own tree", async () => {
    // The guard above must not break intended nesting. This is the regression
    // that matters: over-restricting parent_id would silently disable the map's
    // entire hierarchy.
    const parent = await a.client
      .from("strategic_initiatives")
      .insert({ manager_id: a.userId, title: "A's parent" })
      .select("id")
      .single();
    expect(parent.error, "over-restrictive — cannot create a root row").toBeNull();
    const parentId = (parent.data as { id: string }).id;

    const child = await a.client
      .from("strategic_initiatives")
      .insert({
        manager_id: a.userId,
        title: "A's child",
        parent_id: parentId,
        depth: 1,
      })
      .select("id")
      .single();
    expect(
      child.error,
      "over-restrictive — a manager cannot nest under their own row",
    ).toBeNull();
    const childId = (child.data as { id: string }).id;

    const grandchild = await a.client
      .from("strategic_initiatives")
      .insert({
        manager_id: a.userId,
        title: "A's grandchild",
        parent_id: childId,
        depth: 2,
      })
      .select("id")
      .single();
    expect(
      grandchild.error,
      "over-restrictive — a manager cannot nest to depth 2 under their own rows",
    ).toBeNull();

    // Deleting the root must still cascade away the manager's own descendants.
    const removed = await a.client
      .from("strategic_initiatives")
      .delete()
      .eq("id", parentId)
      .select("id");
    expect(removed.data, "cannot delete own root row").toHaveLength(1);

    const survivors = await a.client
      .from("strategic_initiatives")
      .select("id")
      .in("id", [childId, (grandchild.data as { id: string }).id]);
    expect(
      survivors.data,
      "own descendants were not cascaded away by deleting their root",
    ).toEqual([]);
  });
});
