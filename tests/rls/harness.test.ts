import {
  createTenant,
  isStackAvailable,
  SKIP_MESSAGE,
  type Tenant,
} from "./harness";

// Skip rather than fail when no local stack is running (NFR4).
const suite = isStackAvailable() ? describe : describe.skip;
if (!isStackAvailable()) console.warn(SKIP_MESSAGE);

suite("two-tenant harness", () => {
  let a: Tenant;
  let b: Tenant;

  beforeAll(async () => {
    a = await createTenant("a");
    b = await createTenant("b");
  });

  afterAll(async () => {
    await a?.destroy();
    await b?.destroy();
  });

  it("creates two distinct authenticated managers", () => {
    expect(a.userId).toBeTruthy();
    expect(b.userId).toBeTruthy();
    expect(a.userId).not.toBe(b.userId);
  });

  it("gives each manager a client carrying their own session", async () => {
    const { data: aUser } = await a.client.auth.getUser();
    const { data: bUser } = await b.client.auth.getUser();

    expect(aUser.user?.id).toBe(a.userId);
    expect(bUser.user?.id).toBe(b.userId);
  });

  it("seeds each manager with their own isolated rows", () => {
    expect(a.seed.teamId).not.toBe(b.seed.teamId);
    expect(a.seed.memberId).not.toBe(b.seed.memberId);
    expect(a.seed.interactionId).not.toBe(b.seed.interactionId);
    expect(a.seed.actionItemId).not.toBe(b.seed.actionItemId);
    expect(a.seed.initiativeId).not.toBe(b.seed.initiativeId);
  });

  it("uses the anon key, not the service-role key", () => {
    // A service-role client bypasses RLS entirely and would make every
    // isolation assertion pass vacuously. Guard against that regression.
    expect(a.usesAnonKey).toBe(true);
    expect(b.usesAnonKey).toBe(true);
  });
});
