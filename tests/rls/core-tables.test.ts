import { assertMutuallyIsolated } from "./isolation";
import { createTenant, isStackAvailable, SKIP_MESSAGE, type Tenant } from "./harness";

const suite = isStackAvailable() ? describe : describe.skip;
if (!isStackAvailable()) console.warn(SKIP_MESSAGE);

suite("tenant isolation: core tables", () => {
  let a: Tenant;
  let b: Tenant;

  beforeAll(async () => {
    a = await createTenant("core-a");
    b = await createTenant("core-b");
  });

  afterAll(async () => {
    await a?.destroy();
    await b?.destroy();
  });

  it("isolates profiles", async () => {
    await assertMutuallyIsolated(a, b, {
      table: "profiles",
      mutableColumn: "full_name",
      ownRow: (t) => ({ id: t.userId, full_name: "own-profile" }),
      // A random id rather than the victim's own: inserting the victim's actual
      // id would collide on the primary key (23505) and the assertion would pass
      // without RLS having done anything. This proves the WITH CHECK is what blocks.
      foreignRow: () => ({ id: crypto.randomUUID(), full_name: "stolen" }),
      victimRowId: (v) => v.userId,
      ownRowId: (t) => t.userId,
      // A profile's id IS the auth user id, created by the on_auth_user_created
      // trigger, so a manager can never insert a second one.
      ownInsertAllowed: false,
      // profiles has no DELETE policy at all — rows cascade from auth.users.
      ownDeleteAllowed: false,
    });
  });

  it("isolates teams", async () => {
    await assertMutuallyIsolated(a, b, {
      table: "teams",
      mutableColumn: "name",
      ownRow: (t) => ({ name: "own team", manager_id: t.userId }),
      foreignRow: (v) => ({ name: "stolen team", manager_id: v.userId }),
      victimRowId: (v) => v.seed.teamId,
      ownRowId: (t) => t.seed.teamId,
    });
  });

  it("isolates team_members", async () => {
    await assertMutuallyIsolated(a, b, {
      table: "team_members",
      mutableColumn: "name",
      ownRow: (t) => ({ name: "own member", manager_id: t.userId }),
      foreignRow: (v) => ({ name: "stolen member", manager_id: v.userId }),
      victimRowId: (v) => v.seed.memberId,
      ownRowId: (t) => t.seed.memberId,
    });
  });
});
