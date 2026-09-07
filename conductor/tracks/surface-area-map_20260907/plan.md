# Plan: Surface Area Map

Execution roadmap for [`spec.md`](./spec.md). Task lifecycle, TDD discipline, quality
gates and the Phase Completion Protocol are defined in
[`workflow.md`](../../workflow.md).

Task classification follows `workflow.md` §3:
**[T]** testable — developed test-first, red before green.
**[V]** visual — implemented then verified against the manual UI checklist.

---

## Phase 1 — Data Foundation

Schema and pure logic first, so every later phase builds on a tested base. Nothing
user-facing ships in this phase. The known `parent_id` cross-tenant cascade defect is
closed before any new nesting is built on top of it.

- [ ] Task: Close the `parent_id` cross-tenant cascade defect **[T]**
    - [ ] Write a failing RLS test proving manager A cannot set `parent_id` to a row
          owned by manager B
    - [ ] Write a failing test proving manager B deleting their own row cannot cascade
          away a row owned by manager A
    - [ ] Run `CI=true npm test` and confirm both fail (red)
    - [ ] Add a `WITH CHECK` on `parent_id` ownership, or an equivalent trigger, in
          `supabase/migrations/041_surface_areas.sql`
    - [ ] Confirm green
    - [ ] Confirm existing initiative nesting on `/initiatives` still works
    - [ ] Remove this item from the follow-up list in
          `conductor/archive/vitest-setup_20260906/index.md`

- [ ] Task: Extend `strategic_initiatives` with area columns **[T]**
    - [ ] Read `tests/rls/initiatives.test.ts`, `tests/rls/harness.ts` and
          `tests/rls/isolation.ts` to match existing naming and style
    - [ ] Write failing RLS tests: manager A cannot read or write manager B's rows via
          `kind`, `confidence`, `last_reviewed_at` or `owner_id`
    - [ ] Write failing RLS test: `owner_id` cannot be set to another manager's
          `team_members` row
    - [ ] Run `CI=true npm test` and confirm the new tests fail (red)
    - [ ] Create `supabase/migrations/041_surface_areas.sql` — add `kind`,
          `confidence`, `last_reviewed_at`, `owner_id`, all nullable or defaulted
    - [ ] Add `CHECK` constraints for `kind` and `confidence`
    - [ ] Add index on `(manager_id, kind)`
    - [ ] Confirm no existing migration file was edited
    - [ ] Apply with `npm run db:migrate` and confirm the new tests pass (green)
    - [ ] Update `lib/supabase/types.ts` — `strategic_initiatives` Row/Insert/Update and
          the `StrategicInitiative` export
    - [ ] Add `AreaConfidence` and `InitiativeKind` union types
    - [ ] Verify existing rows are unchanged and `/initiatives` still loads

- [ ] Task: Attention and staleness helpers **[T]**
    - [ ] Write failing tests in `lib/map/attention.test.ts` covering: stale via
          `last_reviewed_at`; stale via `created_at` fallback when
          `last_reviewed_at` is null; not stale inside the threshold; unowned; both
          conditions at once; and the FR6 negative case — an area marked `unknown`
          but recently reviewed and owned is **not** flagged
    - [ ] Confirm red
    - [ ] Implement `lib/map/attention.ts` — `STALENESS_THRESHOLD_DAYS = 21` as a single
          named constant, `isStale()`, `attentionReasons()`
    - [ ] Confirm green
    - [ ] Refactor for clarity with tests as the safety net

- [ ] Task: Confidence ordering and coverage summary helpers **[T]**
    - [ ] Write failing tests in `lib/map/coverage.test.ts` — confidence rank ordering,
          per-domain distribution counts, empty domain, single area
    - [ ] Confirm red
    - [ ] Implement `lib/map/coverage.ts`
    - [ ] Confirm green

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)

---

## Phase 2 — Read Path: The Map View

The map becomes visible and navigable. Still read-only — no capture yet, so this phase
is verified against manually inserted rows.

- [ ] Task: Area grouping and nesting transform **[T]**
    - [ ] Write failing tests in `lib/map/grouping.test.ts` — group flat rows by
          `domain`; nest children under parents to depth 2; orphaned child whose parent
          is absent; area with null `domain`; stable ordering
    - [ ] Confirm red
    - [ ] Implement `lib/map/grouping.ts`
    - [ ] Confirm green

- [ ] Task: `/map` route and data query **[T]**
    - [ ] Write failing test for the query builder helper — filters `kind = 'area'`,
          scopes by `manager_id`, selects owner in the same query (no N+1)
    - [ ] Confirm red
    - [ ] Implement `lib/map/queries.ts`
    - [ ] Create `app/(dashboard)/map/page.tsx` as a server component; `await` any
          `params`/`searchParams`; redirect unauthenticated users to `/login`
    - [ ] Confirm green and confirm a single query in the Supabase logs

- [ ] Task: Scope `/initiatives` to `kind = 'initiative'` **[T]**
    - [ ] Write failing test asserting the initiatives query excludes areas
    - [ ] Confirm red
    - [ ] Add the filter in `app/(dashboard)/initiatives/page.tsx`
    - [ ] Confirm green and confirm `/initiatives` behaviour is otherwise unchanged

- [ ] Task: Map layout — domain groups and area rows **[V]**
    - [ ] Build `components/map/SurfaceAreaMapClient.tsx`
    - [ ] Build `components/map/DomainGroup.tsx` — large heading, coverage summary,
          separated by whitespace and surface shift only
    - [ ] Build `components/map/AreaRow.tsx` — title, confidence, days since review,
          owner or its absence, on one line
    - [ ] Indent child areas beneath parents to depth 2
    - [ ] Apply the attention mark using `tertiary`, once per domain group as a count
          rather than per row
    - [ ] Extract any non-trivial logic into the tested `lib/map/` helpers
    - [ ] Verify: light theme · olive dark theme · mobile, tablet, desktop · theme
          tokens only, no literal hex · no 1px dividers or `<hr>` · keyboard accessible
          with visible focus · loading and empty states handled

- [ ] Task: Sidebar navigation entry **[V]**
    - [ ] Add the Map item to `navItems` in `components/Sidebar.tsx`
    - [ ] Verify the active state uses the project's colour-only treatment
    - [ ] Verify collapsed sidebar tooltip and both themes

- [ ] Task: Empty state and domain starters **[V]**
    - [ ] Write the empty state copy — plain, calm, British spelling, no exclamation marks
    - [ ] Offer Platform, People, Business, Process as suggestions that write nothing
          until acted on
    - [ ] Verify both themes and all breakpoints

- [ ] Task: Domain group collapse persistence **[T]** + **[V]**
    - [ ] Write failing tests for the collapse-state serialisation helper
    - [ ] Confirm red, implement, confirm green
    - [ ] Wire it into `DomainGroup` and verify state survives a reload

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)

---

## Phase 3 — Write Path: Capture, Confidence, Removal

The map becomes usable. After this phase you can populate it by hand and keep it current.

- [ ] Task: Area write API **[T]**
    - [ ] Write failing tests in `app/api/map/areas/route.test.ts` — 401 when
          unauthenticated; Zod rejection of malformed bodies; `kind` forced to `'area'`
          on create; depth limit enforced at 2; parent must belong to the caller;
          `manager_id` taken from the session and never from the body
    - [ ] Write failing tests for PATCH — confidence change sets `last_reviewed_at`;
          review-only touch leaves confidence alone; cross-tenant PATCH is rejected
    - [ ] Write failing tests for DELETE — children removed with the parent;
          cross-tenant DELETE rejected
    - [ ] Confirm red
    - [ ] Implement `app/api/map/areas/route.ts` and
          `app/api/map/areas/[id]/route.ts`
    - [ ] Validate every request body with Zod
    - [ ] Confirm green, both success and failure paths

- [ ] Task: Inline quick-add **[V]**
    - [ ] Build `components/map/InlineAreaAdd.tsx` — Enter commits, input stays focused
          for the next entry, no page reload
    - [ ] Support adding a child area from a parent row, respecting the depth limit
    - [ ] Verify keyboard-only capture of several areas in a row
    - [ ] Verify both themes, all breakpoints, 44x44px touch targets

- [ ] Task: Confidence control and review affordance **[V]**
    - [ ] Build `components/map/ConfidenceControl.tsx` — set inline from the row without
          opening anything
    - [ ] `Select` handlers must accept `string | null` per the project's API notes
    - [ ] Add the separate reviewed affordance that touches `last_reviewed_at` only
    - [ ] Verify the days-since-review figure updates immediately
    - [ ] Verify both themes and keyboard operation

- [ ] Task: Area removal with child count **[V]**
    - [ ] Build inline removal on the row — no modal, and no JavaScript `confirm()`
    - [ ] State the child count before removing a parent
    - [ ] Verify both themes and keyboard operation

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)

---

## Phase 4 — Area Detail: Notes, Owner, Linked Conversations

Depth behind progressive disclosure, and the connection to interactions that makes this
Attune's map rather than a generic outline.

- [ ] Task: Linked interactions query **[T]**
    - [ ] Write failing tests in `lib/map/linkedInteractions.test.ts` — joins
          `interaction_initiative_signals` for one area, returns signal, note and date,
          scoped by `manager_id`, and returns empty rather than throwing when there are
          none
    - [ ] Confirm red
    - [ ] Implement `lib/map/linkedInteractions.ts`
    - [ ] Confirm green

- [ ] Task: Owner assignment API **[T]**
    - [ ] Write failing tests — owner must be one of the caller's own `team_members`;
          another manager's member is rejected; owner can be cleared to null;
          assignment creates no action item and no notification record
    - [ ] Confirm red
    - [ ] Extend the PATCH handler to accept `owner_id`
    - [ ] Confirm green

- [ ] Task: Area detail panel **[V]**
    - [ ] Build `components/map/AreaDetailSheet.tsx` behind progressive disclosure
    - [ ] Show title, domain, confidence, owner, last reviewed
    - [ ] Wire the existing Tiptap editor to the existing `description` JSONB column,
          debounced auto-save, no Save button in the editing path
    - [ ] Verify notes survive a reload and that a failed save never destroys typed text
    - [ ] Verify floating surface uses the tinted diffused shadow, never black
    - [ ] Verify both themes, all breakpoints, keyboard accessible, focus visible

- [ ] Task: Owner picker **[V]**
    - [ ] Build the picker over existing `team_members`, covering both direct reports
          and stakeholders via `relationship`
    - [ ] Allow clearing the owner
    - [ ] Confirm the unowned attention mark clears and reappears correctly
    - [ ] Verify both themes and keyboard operation

- [ ] Task: Linked conversations list **[V]**
    - [ ] Render each linked interaction with its signal, note and date, linking through
          to `/interactions/[id]`
    - [ ] Confirm signals are shown as context only and do not affect the attention mark
    - [ ] Verify the empty case reads plainly
    - [ ] Verify both themes and all breakpoints

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)

---

## Phase 5 — AI Brain Dump

Bulk capture. Deliberately last: the map is fully usable without it, and building it
against a working map means the accept path has somewhere real to land.

- [ ] Task: Prompt and structured output schema **[T]**
    - [ ] Write failing tests for the Zod schema — valid proposal parses; missing
          fields, wrong types and extra fields are rejected
    - [ ] Write failing tests for prompt construction, including existing domains passed
          as context
    - [ ] Confirm red
    - [ ] Add the prompt to `lib/ai/prompts.ts` — propose areas only; never set
          confidence; never assign an owner; never invent an area not traceable to the
          input; when in doubt return less
    - [ ] Implement the schema in `lib/map/suggestSchema.ts`
    - [ ] Confirm green

- [ ] Task: Suggestion API route **[T]**
    - [ ] Write failing tests in `app/api/map/suggest/route.test.ts` — 401 when
          unauthenticated; input validated with Zod; OpenAI mocked, never called for
          real; malformed AI output rejected with a clear error; **the route writes
          nothing to the database**
    - [ ] Confirm red
    - [ ] Implement `app/api/map/suggest/route.ts` with the OpenAI client constructed
          inside the handler, not at module level
    - [ ] Confirm green, both success and failure paths

- [ ] Task: Brain dump UI **[V]**
    - [ ] Build `components/map/BrainDumpSheet.tsx` — paste box and Suggest action
    - [ ] Build the editable review list — retitle, reassign domain, remove a suggestion
    - [ ] Accept writes exactly the accepted set; Discard writes nothing and leaves no
          trace
    - [ ] Verify with 30-50 items pasted at once that the list stays readable and the
          layout holds
    - [ ] Verify both themes, all breakpoints, keyboard accessible, loading state during
          the AI call

- [ ] Task: AI failure handling **[V]**
    - [ ] Show a plain `sonner` toast on failure or malformed output — calm wording, no
          alarm language
    - [ ] Confirm existing areas and any typed text are left untouched
    - [ ] Verify by forcing a failure response

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)

---

## Phase 6 — Hardening and Documentation

- [ ] Task: Accessibility and responsive pass **[V]**
    - [ ] Complete the whole map flow keyboard-only: navigate, add, set confidence,
          assign an owner, remove
    - [ ] Confirm every touch target is at least 44x44px
    - [ ] Confirm no literal hex values anywhere in the new components
    - [ ] Confirm no 1px dividers or `<hr>` anywhere in the new components
    - [ ] Confirm at most one or two `tertiary` elements are visible at once
    - [ ] Re-verify every new screen in light and olive dark themes at all three
          breakpoints

- [ ] Task: Performance verification **[T]** + **[V]**
    - [ ] Confirm the map list issues a single query with a realistic 50-area dataset
    - [ ] Confirm linked conversations load with the detail, not with the list
    - [ ] Add a test asserting the list query shape if not already covered

- [ ] Task: Documentation **[T]**
    - [ ] Update `conductor/tech-stack.md` if anything diverged from it during
          implementation, with a dated note explaining why
    - [ ] Document the area/initiative `kind` split and the attention rules where a
          future reader will find them
    - [ ] Confirm `lib/supabase/types.ts` matches the deployed schema exactly

- [ ] Task: Pre-merge checklist **[T]**
    - [ ] `npm run lint` passes with no errors
    - [ ] `npx tsc --noEmit` passes with no `any` and no `@ts-ignore`
    - [ ] `CI=true npm test` passes, RLS suite included
    - [ ] Migration 041 confirmed additive and backwards-compatible with the deployed app
    - [ ] No new environment variables required
    - [ ] Confirm the product boundary holds: no due dates, no statuses, no board
          semantics crept in during implementation

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)
