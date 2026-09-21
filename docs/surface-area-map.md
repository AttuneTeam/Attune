# Surface Area Map

The invariants and gotchas behind the map — the things not recoverable from any single
file. For the actual logic, follow the pointers.

## One table, two lenses

`strategic_initiatives` holds both the map's **areas** and strategic **initiatives**,
separated only by `kind` (migration 042). Both `/map` and `/initiatives` must filter on
it — see `lib/map/queries.ts` and `lib/initiatives/queries.ts`.

⚠️ `kind` defaults to `'initiative'`, so a query that forgets the filter looks correct
until the first area exists, then silently mixes the manager's onboarding map into their
strategy list. Both filters are asserted by test for exactly this reason.

## The core invariant: a reference must not cross a tenant

RLS scopes rows by `manager_id`, which means it **cannot** see the problem when manager A
writes a row they legitimately own that *points* at a row belonging to manager B. Three
columns have that shape, and each is guarded by a `SECURITY DEFINER` trigger raising
`42501` so it surfaces like any other RLS denial:

| Column | Migration | Why it matters |
|---|---|---|
| `parent_id` | 041 | `ON DELETE CASCADE` — B deleting their row would destroy A's |
| `owner_id` | 042 | renders an owner A cannot identify or clear |
| `domain_id` | 044 | files A's area under a heading A cannot see |

⚠️ If you add another cross-row reference to this table, RLS alone will not protect it.
Copy the trigger shape from `044_map_domains.sql` and add a case to
`tests/rls/domains.test.ts`.

Note the deliberate inconsistency: `move_area` and `move_domain` are `SECURITY INVOKER`,
not `DEFINER`. There the caller's own visibility *is* the check we want, so RLS does the
work — an elevated function would have to re-implement tenancy by hand.

## Attention is staleness and ownership. Nothing else.

`lib/map/attention.ts` is the whole rule. Two conditions flag an area, and the exclusions
are as deliberate as the inclusions:

- **Confidence does not flag.** A manager who records "I do not understand this yet" is
  being honest. Nagging them for it trains the honesty out of the map.
- **Interaction signals do not flag.** A `threatens` signal (migration 040) is context on
  the area detail, never an input to the mark.

⚠️ Both exclusions have explicit negative tests. If you find yourself adding either as an
input, that is a product decision, not a fix — the tests will fail and they are meant to.

Related: **unowned means nobody**, not merely "no team member". An area the manager owns
themselves (`owned_by_manager`, migration 045) is owned. Without that distinction the
column answers nothing about what to delegate.

## Gotchas

**`sr-only` needs a positioned ancestor.** Tailwind's `sr-only` is `position: absolute`;
with none, it resolves against the document rather than the scroll container. Eighteen of
them down the map added ~600px of phantom page height *through* the shell's
`h-screen overflow-hidden`, producing a second scrollbar. Every label's parent in
`components/map/` carries `relative` for this reason — do not remove it. A
`position: relative` on `main` in `DashboardShell` would immunise the app; that is a
shared-layout change nobody has made yet.

**`sort_order` uses `0` as a "not set" sentinel.** Triggers assign `max + 1` on insert
(migrations 043, 044) and real positions start at 1. A plain `DEFAULT` would give every
new row the same position and hand the order back to whatever the tiebreak happened to be.
There is intentionally **no** unique index on `(group, sort_order)` — the swap passes
through a transient duplicate and an index would reject it midway.

**`strategic_initiatives.domain` is still written.** Migration 044 moved grouping to
`domain_id` but kept the text column, because `workflow.md` forbids dropping a column in
the release that stops using it — migrations run *before* the app deploys. The area and
domain routes resolve the name and write both. Dropping the column and removing those
writes is a follow-up for the next release.

## Maintenance rule

Add a tenant-scoped table → add it to `tests/rls/`. Add a cross-row reference → add an
ownership trigger *and* a test. Change `STALENESS_THRESHOLD_DAYS` → the empty-state copy
reads it, so it follows automatically; do not hardcode the number anywhere.

## Verification

`CI=true npm test` covers it. The RLS suite needs a running stack (`supabase start`) and
skips loudly otherwise — a skipped tenancy suite is not a passing one.
