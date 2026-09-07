import { createTenant, isStackAvailable, SKIP_MESSAGE, type Tenant } from "./harness";

/**
 * The surface-area columns added to strategic_initiatives by migration 042.
 *
 * Two distinct concerns are proven here. First, tenant isolation: the new
 * columns must not become a new way to read or write another manager's rows,
 * and `kind` in particular must not turn into a filter that reaches across the
 * boundary. Second, integrity: `owner_id` points at team_members, so the same
 * cross-tenant reference problem that migration 041 closed for `parent_id`
 * applies here and is closed the same way.
 */

const suite = isStackAvailable() ? describe : describe.skip;
if (!isStackAvailable()) console.warn(SKIP_MESSAGE);

type Row = Record<string, unknown>;

suite("surface area columns", () => {
  let a: Tenant;
  let b: Tenant;

  beforeAll(async () => {
    a = await createTenant("area-a");
    b = await createTenant("area-b");
  });

  afterAll(async () => {
    await a?.destroy();
    await b?.destroy();
  });

  /** Creates an area owned by the given tenant and returns its id. */
  async function createArea(t: Tenant, row: Row = {}): Promise<string> {
    const res = await t.client
      .from("strategic_initiatives")
      .insert({ manager_id: t.userId, title: `${t.label} area`, kind: "area", ...row })
      .select("id")
      .single();
    if (res.error) throw new Error(`createArea for ${t.label} failed: ${res.error.message}`);
    return (res.data as { id: string }).id;
  }

  // ── Schema shape ────────────────────────────────────────────────────────

  it("defaults an existing-shaped row to an initiative of unknown confidence", async () => {
    // The migration must be backwards-compatible: migrations run before the app
    // deploys, so for a window the new schema serves the old code, which writes
    // neither column. Those writes must keep behaving exactly as initiatives.
    const inserted = await a.client
      .from("strategic_initiatives")
      .insert({ manager_id: a.userId, title: "written by old code" })
      .select("kind, confidence, last_reviewed_at, owner_id")
      .single();
    expect(inserted.error).toBeNull();
    const row = inserted.data as Row;
    expect(row.kind, "an unspecified row must remain an initiative").toBe("initiative");
    expect(row.confidence).toBe("unknown");
    expect(row.last_reviewed_at, "never reviewed must be null, not now()").toBeNull();
    expect(row.owner_id).toBeNull();
  });

  it("accepts every valid confidence level", async () => {
    for (const confidence of ["unknown", "aware", "understood", "owned"]) {
      const res = await a.client
        .from("strategic_initiatives")
        .insert({
          manager_id: a.userId,
          title: `confidence ${confidence}`,
          kind: "area",
          confidence,
        })
        .select("confidence")
        .single();
      expect(res.error, `confidence '${confidence}' was rejected`).toBeNull();
      expect((res.data as Row).confidence).toBe(confidence);
    }
  });

  it("rejects an unrecognised kind or confidence", async () => {
    // A typo in application code must fail loudly at the database rather than
    // silently creating a row that no view will ever show.
    const badKind = await a.client
      .from("strategic_initiatives")
      .insert({ manager_id: a.userId, title: "bad kind", kind: "territory" })
      .select("id");
    expect(badKind.error, "kind accepts values outside the allowed set").not.toBeNull();
    // 23514 is check_violation. Asserting the code stops this passing for the
    // wrong reason -- a missing column also errors, and would look identical.
    expect(
      badKind.error?.code,
      `rejected by ${badKind.error?.code} rather than a CHECK constraint (23514)`,
    ).toBe("23514");

    const badConfidence = await a.client
      .from("strategic_initiatives")
      .insert({
        manager_id: a.userId,
        title: "bad confidence",
        kind: "area",
        confidence: "quite sure",
      })
      .select("id");
    expect(
      badConfidence.error,
      "confidence accepts values outside the allowed set",
    ).not.toBeNull();
    expect(
      badConfidence.error?.code,
      `rejected by ${badConfidence.error?.code} rather than a CHECK constraint (23514)`,
    ).toBe("23514");
  });

  // ── Tenant isolation ────────────────────────────────────────────────────

  it("isolates areas and every new column", async () => {
    const areaId = await createArea(b, {
      confidence: "aware",
      last_reviewed_at: new Date().toISOString(),
      owner_id: b.seed.memberId,
    });

    const byId = await a.client
      .from("strategic_initiatives")
      .select("id")
      .eq("id", areaId);
    expect(byId.error).toBeNull();
    expect(byId.data, "LEAK — one manager can read another manager's area").toEqual([]);

    // kind is the map's primary filter, so it is the most likely accidental
    // route to another tenant's rows.
    const byKind = await a.client
      .from("strategic_initiatives")
      .select("id")
      .eq("kind", "area");
    expect(
      (byKind.data as Row[]).map((r) => r.id),
      "LEAK — another manager's areas are reachable by filtering on kind",
    ).not.toContain(areaId);

    // Nor by any of the other new columns.
    const byOwner = await a.client
      .from("strategic_initiatives")
      .select("id")
      .eq("owner_id", b.seed.memberId);
    expect(
      byOwner.data,
      "LEAK — another manager's areas are reachable by owner_id",
    ).toEqual([]);

    const byConfidence = await a.client
      .from("strategic_initiatives")
      .select("id")
      .eq("confidence", "aware");
    expect(
      (byConfidence.data as Row[]).map((r) => r.id),
      "LEAK — another manager's areas are reachable by confidence",
    ).not.toContain(areaId);

    // Writes to the new columns must not land either.
    const tampered = await a.client
      .from("strategic_initiatives")
      .update({
        confidence: "owned",
        owner_id: null,
        last_reviewed_at: new Date(0).toISOString(),
      })
      .eq("id", areaId)
      .select("id");
    expect(
      tampered.error,
      `UPDATE errored unexpectedly — ${tampered.error?.message}`,
    ).toBeNull();
    expect(
      tampered.data ?? [],
      "LEAK — one manager can UPDATE another manager's area",
    ).toEqual([]);

    // Confirmed from the owner's side, not just by rows-affected.
    const untouched = await b.client
      .from("strategic_initiatives")
      .select("confidence, owner_id")
      .eq("id", areaId)
      .single();
    const survived = untouched.data as Row;
    expect(survived.confidence, "LEAK — confidence was modified across tenants").toBe(
      "aware",
    );
    expect(survived.owner_id, "LEAK — owner_id was cleared across tenants").toBe(
      b.seed.memberId,
    );

    const attributed = await a.client
      .from("strategic_initiatives")
      .insert({ manager_id: b.userId, title: "stolen area", kind: "area" })
      .select("id");
    expect(
      attributed.error?.code,
      "LEAK — one manager can INSERT an area attributed to another",
    ).toBe("42501");
  });

  // ── owner_id integrity ──────────────────────────────────────────────────

  it("rejects an owner_id belonging to another manager", async () => {
    // Same shape as the parent_id defect closed in migration 041: the row is
    // legitimately A's, so RLS sees nothing wrong, yet it references a row A
    // cannot read. Left open, the map would render an owner the manager has no
    // way to identify or clear, and the reference would silently confirm that a
    // team_members row with that id exists.
    const onInsert = await a.client
      .from("strategic_initiatives")
      .insert({
        manager_id: a.userId,
        title: "A's area owned by B's member",
        kind: "area",
        owner_id: b.seed.memberId,
      })
      .select("id");
    expect(
      onInsert.error,
      "INTEGRITY — owner_id accepts another manager's team member on INSERT",
    ).not.toBeNull();
    expect(onInsert.error?.code).toBe("42501");

    const areaId = await createArea(a);

    const onUpdate = await a.client
      .from("strategic_initiatives")
      .update({ owner_id: b.seed.memberId })
      .eq("id", areaId)
      .select("id");
    expect(
      onUpdate.error,
      "INTEGRITY — owner_id accepts another manager's team member on UPDATE",
    ).not.toBeNull();
    expect(onUpdate.error?.code).toBe("42501");

    const after = await a.client
      .from("strategic_initiatives")
      .select("owner_id")
      .eq("id", areaId)
      .single();
    expect((after.data as Row).owner_id).toBeNull();
  });

  it("allows a manager's own team member as owner, and allows clearing it", async () => {
    // The guard above must not break the feature it protects.
    const areaId = await createArea(a);

    const assigned = await a.client
      .from("strategic_initiatives")
      .update({ owner_id: a.seed.memberId })
      .eq("id", areaId)
      .select("owner_id")
      .single();
    expect(
      assigned.error,
      "over-restrictive — a manager cannot assign their own team member as owner",
    ).toBeNull();
    expect((assigned.data as Row).owner_id).toBe(a.seed.memberId);

    const cleared = await a.client
      .from("strategic_initiatives")
      .update({ owner_id: null })
      .eq("id", areaId)
      .select("owner_id")
      .single();
    expect(cleared.error, "over-restrictive — owner cannot be cleared").toBeNull();
    expect((cleared.data as Row).owner_id).toBeNull();
  });
});
