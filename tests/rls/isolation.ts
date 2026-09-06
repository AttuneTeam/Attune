import { expect } from "vitest";
import type { Tenant } from "./harness";

/**
 * The four ways one tenant could reach another's row, plus the four ways a
 * tenant must still be able to reach their own.
 *
 * Postgres RLS does not raise on a blocked SELECT/UPDATE/DELETE — it silently
 * narrows the row set. So "denied" is asserted as *zero rows affected*, and
 * confirmed from the owner's side that nothing actually changed. Only a blocked
 * INSERT raises (error 42501), because there the row fails the WITH CHECK.
 */

type IsolationCase = {
  /** Table under test. */
  table: string;
  /** A text column that can be freely rewritten by an UPDATE. */
  mutableColumn: string;
  /** Builds a row owned by the given tenant — used for the positive INSERT. */
  ownRow: (tenant: Tenant) => Record<string, unknown>;
  /** Builds a row attributed to the *other* tenant — must be rejected. */
  foreignRow: (victim: Tenant) => Record<string, unknown>;
  /** Row id the victim owns, which the attacker must not reach. */
  victimRowId: (victim: Tenant) => string;
  /** Row id the attacker owns, which they must still reach. */
  ownRowId: (tenant: Tenant) => string;
  /**
   * Some tables intentionally have no DELETE policy (e.g. profiles, which
   * cascade from auth.users). Skip the delete-own assertion there.
   */
  ownDeleteAllowed?: boolean;
  /**
   * Tables where a tenant can only ever own one row (profiles: the primary key
   * IS the auth user id) cannot be inserted into a second time. Skip the
   * insert-own assertion there; delete-own is skipped with it, since it
   * operates on the row that insert would have created.
   */
  ownInsertAllowed?: boolean;
};

/**
 * Runs the full isolation check in BOTH directions.
 *
 * Prefer this over a single assertIsolated call. Checking only A-attacks-B
 * leaves an asymmetric policy — one special-casing a particular user or role —
 * able to pass, and it makes "isolated in both directions" an accurate claim
 * rather than an assumed one.
 */
export async function assertMutuallyIsolated(
  one: Tenant,
  other: Tenant,
  c: IsolationCase,
): Promise<void> {
  await assertIsolated(one, other, c);
  await assertIsolated(other, one, c);
}

export async function assertIsolated(
  attacker: Tenant,
  victim: Tenant,
  c: IsolationCase,
): Promise<void> {
  const victimId = c.victimRowId(victim);
  const attackerId = c.ownRowId(attacker);

  // ── Negative: the attacker must not reach the victim's row ──────────────

  const selected = await attacker.client
    .from(c.table)
    .select("id")
    .eq("id", victimId);
  expect(selected.error, `${c.table}: SELECT of another tenant's row errored`).toBeNull();
  expect(
    selected.data,
    `${c.table}: LEAK — ${attacker.label} can SELECT ${victim.label}'s row`,
  ).toEqual([]);

  const updated = await attacker.client
    .from(c.table)
    .update({ [c.mutableColumn]: "tampered-by-other-tenant" })
    .eq("id", victimId)
    .select("id");
  // Distinguish "RLS denied it" from "the query failed". Without this, a renamed
  // column would null out `data` and pass as a successful denial.
  expect(
    updated.error,
    `${c.table}: UPDATE errored unexpectedly — ${updated.error?.message}`,
  ).toBeNull();
  expect(
    updated.data ?? [],
    `${c.table}: LEAK — ${attacker.label} can UPDATE ${victim.label}'s row`,
  ).toEqual([]);

  // Confirm from the owner's side that nothing was actually written.
  const victimRow = await victim.client
    .from(c.table)
    .select(c.mutableColumn)
    .eq("id", victimId)
    .single();
  expect(
    (victimRow.data as Record<string, unknown> | null)?.[c.mutableColumn],
    `${c.table}: LEAK — ${victim.label}'s row was modified by ${attacker.label}`,
  ).not.toBe("tampered-by-other-tenant");

  const deleted = await attacker.client
    .from(c.table)
    .delete()
    .eq("id", victimId)
    .select("id");
  expect(
    deleted.error,
    `${c.table}: DELETE errored unexpectedly — ${deleted.error?.message}`,
  ).toBeNull();
  expect(
    deleted.data ?? [],
    `${c.table}: LEAK — ${attacker.label} can DELETE ${victim.label}'s row`,
  ).toEqual([]);

  // Confirm the victim's row survived.
  const survived = await victim.client.from(c.table).select("id").eq("id", victimId);
  expect(
    survived.data,
    `${c.table}: LEAK — ${victim.label}'s row was deleted by ${attacker.label}`,
  ).toHaveLength(1);

  const inserted = await attacker.client
    .from(c.table)
    .insert(c.foreignRow(victim))
    .select("id");
  expect(
    inserted.error,
    `${c.table}: LEAK — ${attacker.label} can INSERT a row attributed to ${victim.label}`,
  ).not.toBeNull();
  // Assert RLS did the blocking (42501), not an incidental constraint such as a
  // primary-key collision — otherwise this assertion could pass for the wrong reason.
  expect(
    inserted.error?.code,
    `${c.table}: INSERT was rejected, but by ${inserted.error?.code} rather than RLS (42501)`,
  ).toBe("42501");

  // ── Positive: the attacker must still reach their own rows ──────────────
  // A policy that denied everything would otherwise pass every assertion above.

  const ownSelect = await attacker.client
    .from(c.table)
    .select("id")
    .eq("id", attackerId);
  expect(
    ownSelect.data,
    `${c.table}: over-restrictive — ${attacker.label} cannot SELECT their own row`,
  ).toHaveLength(1);

  const ownUpdate = await attacker.client
    .from(c.table)
    .update({ [c.mutableColumn]: "updated-by-owner" })
    .eq("id", attackerId)
    .select("id");
  expect(
    ownUpdate.data,
    `${c.table}: over-restrictive — ${attacker.label} cannot UPDATE their own row`,
  ).toHaveLength(1);

  if (c.ownInsertAllowed === false) return;

  const ownInsert = await attacker.client
    .from(c.table)
    .insert(c.ownRow(attacker))
    .select("id")
    .single();
  expect(
    ownInsert.error,
    `${c.table}: over-restrictive — ${attacker.label} cannot INSERT their own row`,
  ).toBeNull();

  if (c.ownDeleteAllowed !== false) {
    const ownDelete = await attacker.client
      .from(c.table)
      .delete()
      .eq("id", (ownInsert.data as { id: string }).id)
      .select("id");
    expect(
      ownDelete.data,
      `${c.table}: over-restrictive — ${attacker.label} cannot DELETE their own row`,
    ).toHaveLength(1);
  }
}
