# Spec: Surface Area Map

**Type:** Feature
**Status:** Draft

---

## Overview

A new manager stepping into a broad leadership role holds an unbounded, unmapped
surface: onboarding, hiring, product knowledge, architecture, hands-on delivery,
business strategy, and inherited ownership of a platform built by someone else. The
failure mode is not forgetting a task — action items already cover that. The failure
mode is **not knowing what you have not yet looked at**.

The Surface Area Map is a single compact screen that answers one question: *what is the
full territory I am accountable for, and where am I thin?*

It is built on the existing `strategic_initiatives` tree rather than a new model. That
tree is already nested (depth 0–2), already grouped by `domain`, already tenant-isolated
by RLS, and already receives signals from interactions (migration 040). What it lacks is
a second axis and a view. This track adds both:

- **Confidence** — `unknown` → `aware` → `understood` → `owned`. Not progress on a task;
  how well the manager actually understands and holds that area.
- **Coverage** — when an area was last reviewed, and whether anyone owns it.

The result is a map that visibly decays. An area untouched for three weeks, or with no
owner, surfaces on its own. This is the difference between a second brain and an outline
that quietly goes stale.

### Why not Trello, Excalidraw, or a new table

A generic board would duplicate tools the manager already has and would drift into
`product.md`'s "not project or ticket management" non-goal. The map earns its place in
Attune for one reason: **the manager's 1-on-1 notes already feed it.** An area opened
from the map shows every conversation that touched it, tagged `advances`, `reinforces`,
or `threatens`. No external tool can do that.

This directly serves two success criteria from `product.md`: *proactive signal, not
passive storage*, and *strategy connects to conversations*.

---

## Functional Requirements

### FR1 — Data model (additive migration)

A single migration extends `strategic_initiatives`:

| Column | Type | Notes |
|---|---|---|
| `kind` | `TEXT NOT NULL DEFAULT 'initiative'` | `CHECK (kind IN ('area','initiative'))` |
| `confidence` | `TEXT NOT NULL DEFAULT 'unknown'` | `CHECK (confidence IN ('unknown','aware','understood','owned'))` |
| `last_reviewed_at` | `TIMESTAMPTZ` | Nullable. Null means never reviewed. |
| `owner_id` | `UUID REFERENCES team_members(id) ON DELETE SET NULL` | Nullable. |

- `kind` defaults to `'initiative'` so every existing row keeps its current behaviour and
  `/initiatives` is unaffected the moment the migration lands.
- All four columns are nullable or defaulted, so the migration is backwards-compatible
  with the deployed application — required by the deployment constraint in `workflow.md`
  (migrations run *before* the app deploys).
- An index on `(manager_id, kind)` supports the map query.
- No new table, therefore no new RLS policy: the existing
  `managers_own_initiatives` policy (`FOR ALL USING (manager_id = auth.uid())`) already
  covers every new column. `tests/rls/initiatives.test.ts` is extended to prove the new
  columns cannot be read or written across tenants.
- `lib/supabase/types.ts` is updated to match.

**Pre-existing defect closed in the same migration.** `parent_id` is
`ON DELETE CASCADE` and the current policy checks only `manager_id`, so manager A can
parent their own row into manager B's tree — after which B deleting their initiative
silently destroys A's row. This was logged as a follow-up by the Vitest track and is not
a read leak, but this feature makes cascade deletion a routine user action (FR5) rather
than a rare one. A `WITH CHECK` on `parent_id` ownership, or an equivalent trigger, is
added before any new nesting is built on top of it.

### FR2 — The map view at `/map`

A new route `/map`, added to the sidebar in `components/Sidebar.tsx`.

- Lists every row where `kind = 'area'`, grouped by `domain`.
- Areas appear in the manager's own order within a group (FR9); domain groups are
  ordered alphabetically with the ungrouped bucket last.
- Domains are free text. When the map is empty, four starters are offered — Platform,
  People, Business, Process — as suggestions the manager can accept, rename, or ignore.
  Nothing is written until they act.
- Areas nest to the existing depth limit (0–2). A child renders indented beneath its
  parent.
- Each domain group shows a compact coverage summary: how many areas it holds and the
  distribution of their confidence levels.
- Each area row shows, in one line: title, confidence, days since last review, owner
  (or its absence).
- Collapsing a domain group is remembered across visits.
- Empty state speaks plainly and offers both capture routes from FR4.

### FR3 — Confidence and review

- Confidence is set inline from the area row without opening anything.
- Changing confidence sets `last_reviewed_at` to now.
- An explicit "reviewed" affordance sets `last_reviewed_at` to now without changing
  confidence — for the case where the manager looked at an area and nothing changed.
- Confidence never sorts or filters areas out of view by default. The map's job is to
  show the whole surface.

### FR4 — Capture

Two routes in, both required.

**Inline quick-add.** At the foot of every domain group: type a title, press Enter, the
area is created and the input stays focused for the next one. New areas default to
`confidence = 'unknown'` and no owner. Adding a child area works the same way from a
parent row.

**AI brain dump.** A paste box takes unstructured text — the contents of the manager's
head, or notes from a handover call — and proposes a grouped tree of areas.

- The proposal is rendered as an editable review list: every suggested area can be
  retitled, reassigned to a different domain, or removed before anything is saved.
- **Nothing is written to the database until the manager explicitly accepts.** Discard
  leaves no trace. This honours "AI is offered, never imposed" from
  `product-guidelines.md`.
- Implemented as a new API route. The OpenAI client is constructed inside the handler,
  the prompt lives in `lib/ai/prompts.ts`, and the structured response is validated with
  Zod before it reaches the client. A failed or malformed AI response surfaces as a
  plain toast and leaves the map untouched.
- The AI proposes areas only. It never sets confidence, never assigns an owner, and
  never invents an area that is not traceable to the manager's input — per "extract only
  what is real".

### FR5 — Removal

- An area is removed from the row itself, without a modal.
- Removing an area with children removes the children too. The manager is told the child
  count before it happens, in the same inline affordance.
- Removal is a hard delete of the area rows. No JavaScript `confirm()` dialogs.

### FR6 — Attention signal

Exactly two conditions mark an area as worth a look:

1. **Stale** — `last_reviewed_at` (falling back to `created_at` when null) is at least
   the staleness threshold ago. Threshold is a single named constant in `lib/`, set to
   21 days. The boundary is inclusive so the interface can say "not reviewed in 21 days"
   and mean it; an exclusive boundary would flag on day 22 while the label read 21.
2. **Unowned** — `owner_id` is null.

Deliberately excluded: confidence level and interaction signals do **not** drive
attention. A freshly captured area marked `unknown` is not a problem — it is an honest
entry. The map does not nag the manager about admitting they do not know something.

`tertiary` coral marks attention and nothing else on this screen. Where several areas
qualify, the domain group carries one count rather than every row carrying a mark —
coral's power is its scarcity.

### FR7 — Area detail

Opening an area reveals, behind progressive disclosure:

- Title, domain, confidence, owner, last reviewed.
- Free notes, using the existing Tiptap editor and the existing `description` JSONB
  column. Auto-saved with debounce, no Save button.
- **Linked conversations** — interactions carrying a signal against this area via
  `interaction_initiative_signals`, showing the signal, its note, and the date, each
  linking through to the interaction.

Interaction signals appear here as context. Per FR6 they do not feed the attention
indicator.

### FR8 — Owner assignment

- An owner is chosen from the manager's existing `team_members`, which already includes
  both direct reports and stakeholders via the `relationship` column.
- Assigning an owner is a delegation record for the manager's own thinking. It is not
  surfaced to the owner, does not notify anyone, and does not create an action item.
  Nothing here may read as monitoring a person.

---

### FR9 — Editing, moving and ordering

Added after Phase 3 was demonstrated: capture and removal alone left the map
read-mostly, and a second brain has to be malleable. Renaming and re-grouping
were already accepted by the API and simply had no interface.

**Inline rename.** An area's title is editable in place from the row. Enter commits,
Escape reverts, and blurring commits. A rename explicitly does **not** stamp a review —
tidying up titles must never reset the staleness clock across the map.

**Move between domains.** A row action offers the manager's existing domains, plus a
new one and "Ungrouped". Moving a root takes its descendants with it, since nesting
already wins over domain (FR2).

**Manual ordering.** Areas carry an explicit order within their group, set by the
manager rather than derived. This replaces ordering by creation date, and reverses the
earlier decision to rely on it.

- Ordering is expressed as "move up" / "move down" on the row, not drag-and-drop.
  Every screen in this product is verified at mobile width, and dragging inside a
  scrolling list is poor on touch; up/down works identically on desktop and phone and
  is reachable from the keyboard. Drag-and-drop may be added later as an enhancement,
  never as the only mechanism.
- The swap happens in one database function so two rows cannot end up sharing a
  position, and it runs as the caller so Row-Level Security still applies.
- **Domain groups remain alphabetical**, with the ungrouped bucket last. Domains are a
  text column rather than rows, so giving them an order needs a model they do not have;
  that stays out of scope.

## Non-Functional Requirements

### Design
- Both light and **olive dark** themes correct, theme tokens only, no literal hex.
- The No-Line Rule and Divider Ban hold: domain groups are separated by whitespace and
  surface shifts, never by `<hr>` or `border-bottom`.
- Typography goes big or small — a large domain heading against small metadata labels.
  No screen of uniformly medium text.
- Responsive at mobile, tablet, desktop. Touch targets at least 44x44px.
- Keyboard accessible throughout with visible focus states. Quick-add, confidence
  change, and removal are all reachable without a mouse.
- Loading and empty states handled.

### Voice
Plain, calm, British spelling. "Not reviewed in 21 days", not "OVERDUE". No exclamation
marks, no corporate filler.

### Performance
The map renders from a single Supabase query. No N+1 per area, per domain, or per owner.
Linked conversations load with the area detail, not with the list.

### Tenancy
Every query is scoped by `manager_id`. The RLS suite is extended before the feature is
built, not after.

---

## Acceptance Criteria

1. A migration adds `kind`, `confidence`, `last_reviewed_at` and `owner_id` to
   `strategic_initiatives`, is additive and backwards-compatible, and leaves every
   existing row behaving as an initiative.
2. `tests/rls/initiatives.test.ts` proves against a real database that manager A cannot
   read or write manager B's areas, including all four new columns.
3. Manager A cannot set `parent_id` to a row owned by manager B, and manager B deleting
   their own row cannot cascade away a row owned by manager A. Both are proven by test.
4. `/map` appears in the sidebar and lists all `kind = 'area'` rows grouped by domain,
   nested to depth 2, from a single query.
5. Typing a title into a domain group's inline add and pressing Enter creates an area and
   leaves the input ready for the next, with no page reload.
6. Pasting unstructured text into the brain dump returns a grouped proposal; editing and
   removing suggestions works; accepting writes exactly the accepted set; discarding
   writes nothing.
7. A malformed or failed AI response shows a plain toast and leaves existing areas
   untouched.
8. Changing an area's confidence updates `last_reviewed_at`, and the reviewed affordance
   updates it without changing confidence.
9. An area unreviewed for 21 days or more, or with no owner, is marked as worth a look. An area
   marked `unknown`, recently reviewed and owned, is **not**.
10. Removing an area removes its children, having stated the child count first.
11. An area detail shows its notes, auto-saving without a Save button, and lists linked
    interactions with their signals.
12. An owner can be assigned from existing team members, and assignment notifies nobody
    and creates no action item.
13. Staleness and attention logic live in tested helpers in `lib/`, not inside
    components.
14. The full UI checklist from `workflow.md` passes in both themes and at all three
    breakpoints.
15. An area's title can be renamed from the row, and the rename does **not** change
    `last_reviewed_at`.
16. An area can be moved to another domain, to a new domain, or to ungrouped, and its
    descendants move with it.
17. Areas can be reordered within their group by the manager, the order survives a
    reload, and two areas can never occupy the same position.
18. Reordering and moving are both operable by keyboard and usable at mobile width.
19. `npm run lint`, `npx tsc --noEmit` and `CI=true npm test` all pass.

---

## Out of Scope

- **Task or ticket management.** No columns, no swimlanes, no drag-to-status, no
  sprints, no due dates on areas. Commitments belong in action items, which already
  exist. This boundary is what keeps the feature inside `product.md`'s non-goals.
- **A freeform spatial canvas.** No x/y node positions, no connectors, no pan and zoom.
  The map is a structured outline, not a whiteboard.
- **Drag-and-drop.** Considered for FR9 and deliberately not built: it is unusable on
  touch inside a scrolling list, and this product verifies every screen at mobile width.
  A candidate later enhancement alongside up/down, never replacing it.
- **Re-parenting an area by moving it.** FR9 moves areas between domains, not under a
  different parent. `parent_id` on update stays refused, since changing it requires
  recalculating depth for a whole subtree and guarding against cycles.
- **Ordering domain groups.** Domains are a text column, not rows, so they have nowhere
  to carry an order. Alphabetical stands.
- **Markdown import/export.** Considered and deferred; a candidate follow-up track once
  the map has been in real use.
- **Interaction signals driving attention.** Explicitly excluded per FR6. Revisit only
  after living with staleness and ownership as the signals.
- **Changes to `/initiatives`.** That screen keeps its current behaviour. It gains a
  `kind = 'initiative'` filter and nothing else.
- **Sharing, exporting, or exposing the map to anyone else**, including area owners. This
  is the manager's private thinking tool.
- **Promoting an area into an initiative.** The shared table makes this cheap later; it
  is not built now.
- **Notifications or digests** about stale areas. The signal lives on the map, which the
  manager visits deliberately.
