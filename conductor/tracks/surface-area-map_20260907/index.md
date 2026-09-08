# Track: Surface Area Map

**ID:** `surface-area-map_20260907`
**Type:** Feature
**Status:** New
**Branch:** `feature/surface-area-map`

## Documents

-   [Specification](./spec.md)
-   [Implementation Plan](./plan.md)
-   [Metadata](./metadata.json)

## Project Context

-   [Project Index](../../index.md)

## Summary

A compact map of the whole territory a manager is accountable for, built on the existing
`strategic_initiatives` tree rather than a new model. Adds two axes the tree lacks —
**confidence** (`unknown` → `aware` → `understood` → `owned`) and **coverage** (when an
area was last reviewed, and whether anyone owns it) — so the map visibly decays and
surfaces what has been quietly neglected.

Capture is inline type-and-Enter, plus an AI brain dump that proposes a grouped tree from
unstructured text and writes nothing until accepted. Opening an area shows the
interactions that touched it, tagged `advances` / `reinforces` / `threatens` via
migration 040 — the reason this belongs in Attune rather than in Trello.

## Key Decisions

-   **Shared table, not a new one.** `kind` (`'area' | 'initiative'`) discriminates.
    Reuses existing nesting, RLS and interaction signals; an area can graduate into an
    initiative later without a migration.
-   **Attention is staleness and ownership only.** Confidence level and negative
    interaction signals deliberately do **not** drive the attention mark. A freshly
    captured area marked `unknown` is an honest entry, not a problem.
-   **Not a task board.** No due dates, statuses, swimlanes or drag-to-status.
    Commitments belong in action items. This boundary keeps the feature inside the
    "not project or ticket management" non-goal in `product.md`.
-   **AI proposes, never writes.** The brain dump's suggestions are editable and
    discardable; nothing reaches the database without explicit acceptance.

## Carried-Over Defect

Phase 1 closes a defect logged as a follow-up by the Vitest track: `parent_id` is
`ON DELETE CASCADE` while the policy checks only `manager_id`, so one manager can parent
a row into another's tree and a delete there destroys the first manager's row. This track
makes cascade deletion routine, so the fix lands before any new nesting is built on it.

## Follow-up Tracks

Identified during implementation, to be planned separately:

-   **Realise tonal layering in light mode.** `bg-card` and `bg-background` are the same
    value in light (`#fcf9f2`), with the intended card colour commented out — already
    recorded as Known Drift in `product-guidelines.md`. The map is the screen where it
    costs most: its domain groups are invisible containers in light mode and rely
    entirely on whitespace, while the olive dark theme shows the intended soft inset.
    Deliberately not fixed inside this track — it affects every card in the product, so
    it would change screens far outside the map's scope and make this branch much harder
    to review.
-   **Drop the retiring `strategic_initiatives.domain` text column.** Migration 044
    added `domain_id` and kept the text column written alongside, because
    `workflow.md` forbids dropping a column in the release that stops using it —
    migrations run before the application deploys, so the old code is still reading it
    during that window. This track *is* the release that stops using it, so the drop
    belongs to the next one. It needs: confirming nothing reads it for areas, removing
    the name-resolution writes from the area and domain routes, the migration, and a
    `lib/supabase/types.ts` update.
-   **Anchor `sr-only` labels app-wide.** Tailwind's `sr-only` is
    `position: absolute`; without a positioned ancestor it resolves against the
    document rather than the scroll container, silently extending page height. This
    produced a second scrollbar on `/map` (fixed in-track by positioning each label's
    parent). Existing usages elsewhere sit inside dialogs and sheets, which are already
    positioned, so nothing else is broken today — but the next long list with per-row
    labels will hit it. A `position: relative` on `main` in `DashboardShell` would
    immunise the whole app; that is a shared-layout change and wants its own track.
-   **Component testing for the map's interactions.** Enter-to-commit, Escape-to-cancel,
    the confidence menu and the removal confirmation have no automated cover. The
    `jsdom` Vitest project exists but is empty, and the Vitest track logged a peer
    conflict (`@vitejs/plugin-react` vs `@babel/core@^8`) that must be resolved first.
    Verified manually instead; worth automating before this surface grows.
-   **Honest failure handling on `/initiatives`.** `fetchInitiatives` returns `[]` on a
    failed query, so a broken load renders as "no initiatives". `/map` distinguishes the
    two cases (`MapAreasResult`). Retrofitting that onto `/initiatives` is a behaviour
    change to a screen already in use, so it was left alone here and asserted by test to
    keep the current behaviour deliberate.
