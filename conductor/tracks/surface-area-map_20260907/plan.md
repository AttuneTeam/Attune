# Plan: Surface Area Map

Execution roadmap for [`spec.md`](./spec.md). Task lifecycle, TDD discipline, quality
gates and the Phase Completion Protocol are defined in
[`workflow.md`](../../workflow.md).

Task classification follows `workflow.md` §3:
**[T]** testable — developed test-first, red before green.
**[V]** visual — implemented then verified against the manual UI checklist.

---

## Phase 1 — Data Foundation [checkpoint: 5a413fd]

Schema and pure logic first, so every later phase builds on a tested base. Nothing
user-facing ships in this phase. The known `parent_id` cross-tenant cascade defect is
closed before any new nesting is built on top of it.

- [x] Task: Close the `parent_id` cross-tenant cascade defect **[T]** `b75ae1c`
    - [x] Write a failing RLS test proving manager A cannot set `parent_id` to a row
          owned by manager B — covers both the INSERT and the UPDATE path, the only
          two ways the coupling can be created
    - [x] Write a failing test proving manager B deleting their own row cannot cascade
          away a row owned by manager A — discharged by proving the coupling cannot be
          created at all, plus a regression guard that own-tree cascading still works
    - [x] Run `CI=true npm test` and confirm both fail (red)
    - [x] Add a `WITH CHECK` on `parent_id` ownership, or an equivalent trigger, in
          `supabase/migrations/041_initiative_parent_ownership.sql` — a trigger, since
          an RLS policy cannot subquery its own table without infinite recursion
    - [x] Confirm green — 15/15 rls, 89/89 full suite
    - [ ] Confirm existing initiative nesting on `/initiatives` still works — DB layer
          proven by the regression test; UI check deferred to the Phase 1 manual
          verification plan
    - [x] Remove this item from the follow-up list in
          `conductor/archive/vitest-setup_20260906/index.md` — moved to a
          "Resolved Follow-ups" section so the record stays honest

- [x] Task: Extend `strategic_initiatives` with area columns **[T]** `91a6b40`
    - [x] Read `tests/rls/initiatives.test.ts`, `tests/rls/harness.ts` and
          `tests/rls/isolation.ts` to match existing naming and style
    - [x] Write failing RLS tests: manager A cannot read or write manager B's rows via
          `kind`, `confidence`, `last_reviewed_at` or `owner_id` — new file
          `tests/rls/surface-areas.test.ts`
    - [x] Write failing RLS test: `owner_id` cannot be set to another manager's
          `team_members` row — INSERT and UPDATE paths, plus a guard that a manager's
          own member is still accepted and clearable
    - [x] Run `CI=true npm test` and confirm the new tests fail (red) — 6 failed / 15
          passed, after strengthening one that first passed for the wrong reason
    - [x] Create `supabase/migrations/042_surface_areas.sql` — add `kind`,
          `confidence`, `last_reviewed_at`, `owner_id`, all nullable or defaulted
    - [x] Add `CHECK` constraints for `kind` and `confidence` — named, and asserted by
          SQLSTATE 23514 rather than merely "errored"
    - [x] Add index on `(manager_id, kind)`
    - [x] Confirm no existing migration file was edited — `git diff HEAD` over
          `supabase/migrations/` was empty
    - [x] Apply with `npm run db:migrate` and confirm the new tests pass (green) —
          21/21 rls, 95/95 full suite
    - [x] Update `lib/supabase/types.ts` — the hand-written `StrategicInitiative`
          export (this table is not in the generated `Database` block)
    - [x] Add `AreaConfidence` and `InitiativeKind` union types
    - [x] Verify existing rows are unchanged — 15 rows, all `initiative` / `unknown`,
          none reviewed, none owned, zero cross-manager references
    - [ ] Confirm `/initiatives` still loads — deferred to the Phase 1 manual
          verification plan

- [x] Task: Attention and staleness helpers **[T]** `e94d277`
    - [x] Write failing tests in `lib/map/attention.test.ts` covering: stale via
          `last_reviewed_at`; stale via `created_at` fallback when
          `last_reviewed_at` is null; not stale inside the threshold; unowned; both
          conditions at once; and the FR6 negative case — an area marked `unknown`
          but recently reviewed and owned is **not** flagged, plus a second negative
          case for a `threatens` interaction signal
    - [x] Confirm red
    - [x] Implement `lib/map/attention.ts` — `STALENESS_THRESHOLD_DAYS = 21` as a single
          named constant, `isStale()`, `attentionReasons()`, plus `daysSinceReview()`
          and `needsAttention()` for the row display
    - [x] Confirm green — 95/95 node, 116/116 full suite
    - [x] Refactor for clarity with tests as the safety net — boundary made inclusive;
          `spec.md` FR6 and AC 9 reworded from "more than" to "at least" to match

- [x] Task: Confidence ordering and coverage summary helpers **[T]** `5a413fd`
    - [x] Write failing tests in `lib/map/coverage.test.ts` — confidence rank ordering,
          per-domain distribution counts, empty domain, single area, plus the
          per-domain attention count and the normalised coverage score
    - [x] Confirm red
    - [x] Implement `lib/map/coverage.ts`
    - [x] Confirm green — 107/107 node, 128/128 full suite

- [x] Task: Phase Verification & Checkpoint (Refer to `workflow.md`) `5a413fd`

---

## Phase 2 — Read Path: The Map View [checkpoint: 8398428]

The map becomes visible and navigable. Still read-only — no capture yet, so this phase
is verified against manually inserted rows.

- [x] Task: Area grouping and nesting transform **[T]** `cf061e8`
    - [x] Write failing tests in `lib/map/grouping.test.ts` — group flat rows by
          `domain`; nest children under parents to depth 2; orphaned child whose parent
          is absent; area with null `domain`; stable ordering; plus a parent cycle, a
          child whose domain differs from its parent's, and subtree-wide summaries
    - [x] Confirm red
    - [x] Implement `lib/map/grouping.ts` and `lib/map/types.ts`
    - [x] Confirm green — 121/121 node, 142/142 full suite

- [x] Task: `/map` route and data query **[T]** `9dc7b98`
    - [x] Write failing test for the query builder helper — filters `kind = 'area'`,
          scopes by `manager_id`, selects owner in the same query (no N+1), plus the
          failure branch and owner-embed normalisation
    - [x] Confirm red
    - [x] Implement `lib/map/queries.ts`
    - [x] Create `app/(dashboard)/map/page.tsx` as a server component; no
          `params`/`searchParams` on this route, so nothing to await; redirects
          unauthenticated users to `/login`
    - [x] Confirm green and confirm a single query — 133/133 node, 154/154 full suite;
          the FK hint and embed cardinality were additionally probed against the real
          database, and the route verified as 307 while an unknown route 404s

- [x] Task: Scope `/initiatives` to `kind = 'initiative'` **[T]** `33c21cd`
    - [x] Write failing test asserting the initiatives query excludes areas — required
          extracting the query to `lib/initiatives/queries.ts` to be assertable
    - [x] Confirm red
    - [x] Add the filter in `app/(dashboard)/initiatives/page.tsx`, and also to the
          initiative editor's children query — an area parented under an initiative
          would otherwise render there
    - [x] Confirm green — 143/143 node, 164/164 full suite; `npm run build` succeeds
          with both routes in the manifest. Rendering unchanged for a signed-in
          manager is covered by the Phase 2 manual verification plan

- [x] Task: Map layout — domain groups and area rows **[V]** `13d8b59`
    - [x] Build `components/map/SurfaceAreaMapClient.tsx`
    - [x] Build `components/map/DomainGroup.tsx` — heading, coverage summary,
          separated by whitespace and surface shift only
    - [x] Build `components/map/AreaRow.tsx` — title, confidence, review age,
          owner or its absence, on one line
    - [x] Indent child areas beneath parents to depth 2 — by margin alone, no guide lines
    - [x] Apply the attention mark once per domain group as a count rather than per
          row — but **not** in `tertiary`: one coral per domain is four on a typical
          screen, so the group count is emphasised by weight and the single coral
          figure sits in the page header
    - [x] Extract any non-trivial logic into the tested `lib/map/` helpers —
          `formatReviewAge()`, `filledCoverageDots()`
    - [x] Verified statically: theme tokens only, no literal hex · no 1px dividers or
          `<hr>` · visible focus ring · 44x44 toggle · aria-expanded/controls/sr-only ·
          empty and failure states handled
    - [ ] **Open:** light and olive dark themes, and the three breakpoints — could not
          reach an authenticated session locally (see the git note); carried into the
          Phase 2 manual verification plan

- [x] Task: Sidebar navigation entry **[V]** `540e948`
    - [x] Add the Map item to `navItems` in `components/Sidebar.tsx` — placed after
          Home, since the map is a daily surface
    - [x] Verify the active state uses the project's colour-only treatment — inherited
          from `navItems`, no new styling added
    - [ ] **Open:** collapsed sidebar tooltip and both themes — carried into the
          Phase 2 manual verification plan

- [x] Task: Empty state and domain starters **[V]** `58a6192`
    - [x] Write the empty state copy — plain, calm, British spelling, no exclamation
          marks; defines what an area is, and reads the threshold from
          `STALENESS_THRESHOLD_DAYS` so the copy cannot drift from the behaviour
    - [x] Offer Platform, People, Business, Process as suggestions that write nothing
          until acted on — shipped as **text, not buttons**: capture is Phase 3, and a
          control that looked actionable and did nothing would be worse than none
    - [ ] **Open:** both themes and all breakpoints — carried into the Phase 2 manual
          verification plan

- [x] Task: Domain group collapse persistence **[T]** + **[V]** `8398428`
    - [x] Write failing tests for the collapse-state serialisation helper — including
          malformed JSON, wrong-shape JSON, non-string entries, the size cap, and a
          domain named "ungrouped" colliding with the ungrouped bucket
    - [x] Confirm red, implement, confirm green — 184/184 full suite
    - [x] Wire it into `DomainGroup` — cookie read server-side so the first paint is
          already correct; round-trip verified through the real helpers
    - [ ] **Open:** confirm the state survives a browser reload — carried into the
          Phase 2 manual verification plan

- [x] Task: Phase Verification & Checkpoint (Refer to `workflow.md`) `8398428`

---

## Phase 3 — Write Path: Capture, Confidence, Removal

The map becomes usable. After this phase you can populate it by hand and keep it current.

- [x] Task: Area write API **[T]** `cef64e6`
    - [x] Write failing tests in `app/api/map/areas/route.test.ts` — 401 when
          unauthenticated; Zod rejection of malformed bodies; `kind` forced to `'area'`
          on create; depth limit enforced at 2; parent must belong to the caller;
          `manager_id` taken from the session and never from the body; plus a refusal
          to nest an area under an initiative
    - [x] Write failing tests for PATCH — confidence change sets `last_reviewed_at`;
          review-only touch leaves confidence alone; a rename does **not** stamp a
          review; cross-tenant PATCH returns 404
    - [x] Write failing tests for DELETE — children removed with the parent (proven
          against real Postgres in `tests/rls/surface-areas.test.ts`, including that
          the cascade reaches neither an unrelated area nor another manager's);
          cross-tenant DELETE returns 404
    - [x] Confirm red
    - [x] Implement `app/api/map/areas/route.ts` and
          `app/api/map/areas/[id]/route.ts`
    - [x] Validate every request body with Zod — strict schemas in
          `lib/map/areaInput.ts`, so server-owned fields are a 400 rather than a
          silently dropped field
    - [x] Confirm green, both success and failure paths — 229/229 full suite

- [x] Task: Inline quick-add **[V]** `5ce28bb`
    - [x] Build `components/map/InlineAreaAdd.tsx` — Enter commits, input stays focused
          for the next entry, no page reload; typed text survives a failure
    - [x] Support adding a child area from a parent row, respecting the depth limit
    - [x] Make the empty state's starter domains actionable — now `aria-pressed`
          buttons that select where the first area lands
    - [x] Client calls extracted to a tested `lib/map/api.ts` — server error, HTML
          error body, network rejection and empty-200 paths all covered
    - [ ] **Open:** keyboard-only capture of several areas in a row, both themes, all
          breakpoints — to be checked in the browser before the Phase 3 checkpoint

- [x] Task: Confidence control and review affordance **[V]** `0c743bc`
    - [x] Build `components/map/ConfidenceControl.tsx` — the chip is the control, set
          inline from the row without opening anything
    - [x] Used `DropdownMenu` rather than `Select`, so the `string | null` handler
          caveat does not apply; the menu also carries the review action
    - [x] Add the separate reviewed affordance that touches `last_reviewed_at` only —
          a labelled menu item, deliberately **not** a click on the staleness figure,
          where a stray click would silently destroy the signal
    - [ ] **Open:** the days-since-review figure updating immediately, both themes,
          and keyboard operation of the menu — to be checked in the browser before the
          Phase 3 checkpoint

- [x] Task: Area removal with child count **[V]** `3b4cce7`
    - [x] Build inline removal on the row — a line beneath the row, no modal, no
          JavaScript `confirm()` (grepped: no `alert`/`confirm`/`prompt` calls)
    - [x] State the child count before removing a parent — `countDescendants()` walks
          the whole subtree, with copy pluralised properly
    - [ ] **Open:** both themes and keyboard operation (Escape to cancel, focus landing
          on Remove) — to be checked in the browser before the Phase 3 checkpoint

- [x] Task: Manual ordering — `sort_order` column and swap function **[T]** `9bb524d`
    - [x] Write failing RLS tests: `sort_order` is isolated across tenants, and one
          manager cannot reorder another's areas through the swap function
    - [x] Write failing tests asserting the list query orders by `sort_order` before
          `created_at`, and that grouping preserves it
    - [x] Confirm red
    - [x] Create `supabase/migrations/043_area_sort_order.sql` — add `sort_order`,
          backfill sequentially per (manager, parent, domain) by `created_at` so the
          current order is preserved exactly, and add a `move_area` function that swaps
          two siblings in one statement, running as the caller so RLS still applies
    - [x] Update `lib/map/queries.ts`, `lib/map/grouping.ts` and
          `lib/supabase/types.ts`
    - [x] Confirm green, and confirm two areas cannot end up sharing a position

- [x] Task: Reorder API **[T]** `05f5e7b`
    - [x] Write failing tests — 401 unauthenticated; direction validated; 404 for an
          area that is not the caller's; a no-op at the top and bottom of a group
    - [x] Confirm red
    - [x] Implement the route over the `move_area` function
    - [x] Confirm green, both success and failure paths

- [x] Task: Inline rename **[V]** `0ce16fb`
    - [x] Make the row title editable in place — Enter commits, Escape reverts (via a
          ref, so it beats the blur that follows), blur commits. Double-click, not
          single-click: a single click stays free for Phase 4's detail panel
    - [x] Confirm a rename does **not** change `last_reviewed_at` — enforced and tested
          in `toAreaUpdate`
    - [x] Keep the typed title on failure, as quick-add does
    - [ ] **Open:** keyboard operation, both themes, all breakpoints

- [x] Task: Move to another domain **[V]** `0ce16fb`
    - [x] Add a row action listing existing domains, plus a new domain and "Ungrouped" —
          also closes a gap: a domain could previously only be created from the empty
          state, so a manager with areas had no way to add one
    - [x] Confirm descendants move with a root — nesting already wins over domain (FR2),
          so a root's subtree follows it
    - [ ] **Open:** keyboard operation and both themes

- [x] Task: Reorder controls **[V]** `0ce16fb`
    - [x] Add move up / move down to the row, disabled at the ends of a group — disabled
          rather than hidden, so a missing control never reads as a mistake
    - [x] Confirm the order survives a reload — `sort_order` is persisted and the query
          orders by it
    - [ ] **Open:** keyboard operation, both themes, and usability at mobile width

- [x] Task: Create a new domain from the map **[V]** `e07fa18`
    - [x] Add a page-level "New domain" control — names a group and shows it
          immediately with its own quick-add
    - [x] The domain becomes real when its first area lands; no empty rows are written
    - [x] Drop a pending group once the real one exists, so it never renders twice
    - [x] Share one domain-ordering rule between the transform and the pending groups —
          `compareDomains` extracted and tested
    - [ ] **Open:** keyboard operation and both themes

- [x] Task: Repair the map layout at mobile width **[V]** `d0417d0`
    - [x] Found by rendering at 406px: titles collapsed to zero width, owner clipped,
          page scrolling horizontally — three responsive-checklist violations on a
          screen that had already passed the static audit
    - [x] Rows wrap below `sm` with the title on its own line; fixed columns retained
          from `sm` upward, where they are what makes the group scannable
    - [x] Re-verified at 406px and at desktop width

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)

---

## Phase 4 — Domains as First-Class Entities

Raised by the manager after Phase 3: create a domain from a dialog, rename a domain,
reorder domains. All three are one problem — a domain is a text string repeated on every
area, so renaming rewrites every row and there is nowhere to record an order.

- [ ] Task: `map_domains` table and area reference **[T]**
    - [ ] Write failing RLS tests for the new table — one manager cannot read, write or
          delete another's domains, and cannot point an area at another's domain
    - [ ] Write failing tests for the backfill shape and for deletion leaving areas
          in place, ungrouped
    - [ ] Confirm red
    - [ ] Create the migration — `map_domains` (manager, name, sort_order), a
          `domain_id` reference on `strategic_initiatives`, RLS on the new table, and an
          ownership trigger mirroring 041/042 so an area cannot reference another
          manager's domain
    - [ ] Backfill a row per distinct (manager, domain) and set `domain_id`
    - [ ] Keep the `domain` text column written alongside for one release — `workflow.md`
          forbids dropping a column in the release that stops using it
    - [ ] `ON DELETE SET NULL`, so removing a domain ungroups its areas rather than
          deleting them
    - [ ] Update `lib/supabase/types.ts`
    - [ ] Confirm green

- [ ] Task: Read the map from domain rows **[T]**
    - [ ] Write failing tests — the query joins domains, and grouping orders by the
          manager's `sort_order` rather than alphabetically
    - [ ] Confirm red
    - [ ] Update `lib/map/queries.ts` and `lib/map/grouping.ts`; retire `compareDomains`
          alphabetical ordering and the FR9 pending-group device, which an empty domain
          row now makes unnecessary
    - [ ] Confirm green

- [ ] Task: Domain write API **[T]**
    - [ ] Write failing tests — create, rename, reorder and delete; 401; Zod validation;
          a name unique per manager; cross-tenant rejection; delete ungroups rather than
          removes
    - [ ] Confirm red
    - [ ] Implement the routes, reusing the `move_area` swap approach for domain order
    - [ ] Confirm green, both success and failure paths

- [ ] Task: Domain dialog and controls **[V]**
    - [ ] Create and rename a domain in one dialog, reached from the header and from the
          domain heading
    - [ ] Move a domain up and down, disabled at the ends
    - [ ] Delete a domain, stating plainly that its areas become ungrouped rather than
          being removed
    - [ ] Verify keyboard operation, both themes, all breakpoints

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)

## Phase 5 — Area Detail: Notes, Owner, Linked Conversations

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

- [ ] Task: Owner assignment API, including self-ownership **[T]**
    - [ ] Write failing tests — owner must be one of the caller's own `team_members`;
          another manager's member is rejected; owner can be cleared to null;
          assignment creates no action item and no notification record
    - [ ] Write failing tests for self-ownership (FR8) — an area can be owned by the
          manager, that is distinct from both a named owner and from nobody, and it does
          **not** carry the unowned attention mark
    - [ ] Confirm red
    - [ ] Add the self-ownership flag in a migration; deliberately not a `team_members`
          row for the manager, which would surface them in the team list, coverage and
          pulse
    - [ ] Extend the PATCH handler to accept `owner_id` and the self flag, rejecting
          both being set at once
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
    - [ ] Offer "Me" as a first-class choice — many areas on a personal map are the
          manager's own
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

## Phase 6 — AI Brain Dump

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

## Phase 7 — Hardening and Documentation

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
    - [ ] Migration 042 confirmed additive and backwards-compatible with the deployed app
    - [ ] No new environment variables required
    - [ ] Confirm the product boundary holds: no due dates, no statuses, no board
          semantics crept in during implementation

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)
