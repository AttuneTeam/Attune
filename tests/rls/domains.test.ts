import { assertMutuallyIsolated } from "./isolation";
import { createTenant, isStackAvailable, SKIP_MESSAGE, type Tenant } from "./harness";

/**
 * Domains as rows (migration 044).
 *
 * A new tenant-scoped table, so product.md's rule applies: it goes into this
 * suite in the same change that creates it. Beyond ordinary isolation there are
 * two shapes worth proving — an area must not be able to reference another
 * manager's domain (the same cross-tenant reference class closed for parent_id
 * in 041 and owner_id in 042), and deleting a domain must ungroup its areas
 * rather than delete them. Losing a heading must never lose the territory
 * underneath it.
 */

const suite = isStackAvailable() ? describe : describe.skip;
if (!isStackAvailable()) console.warn(SKIP_MESSAGE);

type Row = Record<string, unknown>;

suite("tenant isolation: map_domains", () => {
  let a: Tenant;
  let b: Tenant;
  let aDomainId: string;
  let bDomainId: string;

  async function createDomain(t: Tenant, name: string): Promise<string> {
    const res = await t.client
      .from("map_domains")
      .insert({ manager_id: t.userId, name })
      .select("id")
      .single();
    if (res.error) throw new Error(`createDomain(${name}) for ${t.label}: ${res.error.message}`);
    return (res.data as { id: string }).id;
  }

  async function createArea(t: Tenant, row: Row = {}): Promise<string> {
    const res = await t.client
      .from("strategic_initiatives")
      .insert({ manager_id: t.userId, title: `${t.label} area`, kind: "area", ...row })
      .select("id")
      .single();
    if (res.error) throw new Error(`createArea for ${t.label}: ${res.error.message}`);
    return (res.data as { id: string }).id;
  }

  beforeAll(async () => {
    a = await createTenant("dom-a");
    b = await createTenant("dom-b");
    aDomainId = await createDomain(a, `A base ${Date.now()}`);
    bDomainId = await createDomain(b, `B base ${Date.now()}`);
  });

  afterAll(async () => {
    await a?.destroy();
    await b?.destroy();
  });

  it("isolates map_domains", async () => {
    await assertMutuallyIsolated(a, b, {
      table: "map_domains",
      mutableColumn: "name",
      ownRow: (t) => ({ manager_id: t.userId, name: `own ${t.label} ${Math.random()}` }),
      foreignRow: (v) => ({ manager_id: v.userId, name: `stolen ${Math.random()}` }),
      victimRowId: (v) => (v.label === a.label ? aDomainId : bDomainId),
      ownRowId: (t) => (t.label === a.label ? aDomainId : bDomainId),
    });
  });

  it("lets two managers each have a domain of the same name", async () => {
    // Uniqueness is per manager. A global constraint would leak the existence
    // of another tenant's domain through a failed insert.
    const name = `Platform ${Date.now()}`;
    const first = await createDomain(a, name);
    const second = await createDomain(b, name);
    expect(first).not.toBe(second);
  });

  it("refuses a second domain with the same name for one manager", async () => {
    const name = `Duplicate ${Date.now()}`;
    await createDomain(a, name);
    const again = await a.client
      .from("map_domains")
      .insert({ manager_id: a.userId, name })
      .select("id");
    expect(again.error, "a manager can create two domains with the same name").not.toBeNull();
  });

  it("refuses an area pointing at another manager's domain", async () => {
    // Same class as parent_id (041) and owner_id (042): the row is legitimately
    // A's, so RLS sees nothing wrong, yet it references a row A cannot read.
    const onInsert = await a.client
      .from("strategic_initiatives")
      .insert({
        manager_id: a.userId,
        title: "A's area in B's domain",
        kind: "area",
        domain_id: bDomainId,
      })
      .select("id");
    expect(
      onInsert.error,
      "INTEGRITY — an area accepted another manager's domain on INSERT",
    ).not.toBeNull();
    expect(onInsert.error?.code).toBe("42501");

    const areaId = await createArea(a);
    const onUpdate = await a.client
      .from("strategic_initiatives")
      .update({ domain_id: bDomainId })
      .eq("id", areaId)
      .select("id");
    expect(
      onUpdate.error,
      "INTEGRITY — an area accepted another manager's domain on UPDATE",
    ).not.toBeNull();
    expect(onUpdate.error?.code).toBe("42501");
  });

  it("accepts a manager's own domain, and allows clearing it", async () => {
    // The guard must not break the feature it protects.
    const areaId = await createArea(a);
    const assigned = await a.client
      .from("strategic_initiatives")
      .update({ domain_id: aDomainId })
      .eq("id", areaId)
      .select("domain_id")
      .single();
    expect(assigned.error, "over-restrictive — own domain rejected").toBeNull();
    expect((assigned.data as Row).domain_id).toBe(aDomainId);

    const cleared = await a.client
      .from("strategic_initiatives")
      .update({ domain_id: null })
      .eq("id", areaId)
      .select("domain_id")
      .single();
    expect(cleared.error).toBeNull();
    expect((cleared.data as Row).domain_id).toBeNull();
  });

  it("ungroups areas when their domain is deleted, rather than deleting them", async () => {
    // The single most important behaviour in this migration. ON DELETE CASCADE
    // here would mean removing a heading silently destroys everything filed
    // under it.
    const doomedId = await createDomain(a, `Doomed ${Date.now()}`);
    const areaId = await createArea(a, { title: "survivor", domain_id: doomedId });

    const removed = await a.client
      .from("map_domains")
      .delete()
      .eq("id", doomedId)
      .select("id");
    expect(removed.data, "could not delete own domain").toHaveLength(1);

    const survivor = await a.client
      .from("strategic_initiatives")
      .select("id, domain_id")
      .eq("id", areaId)
      .single();
    expect(
      survivor.error,
      "DATA LOSS — deleting a domain deleted the areas filed under it",
    ).toBeNull();
    expect((survivor.data as Row).domain_id, "the area was not ungrouped").toBeNull();
  });
});
