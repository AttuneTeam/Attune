# Plan: Install Vitest and Establish Initial Test Suite

**Track Type:** Chore
**Spec:** [spec.md](./spec.md)

> Follows `conductor/workflow.md`. Phases 2-4 are strict Red -> Green -> Refactor.
> Phase 1 is infrastructure, verified by a smoke test proving the runner can fail.

---

## Phase 1: Vitest Infrastructure [checkpoint: 87db700]

Establishes the runner. Cannot be test-first — the runner is what runs tests. Verified
instead by proving the harness reports both failure and success.

- [x] Task: Install Vitest and dependencies (96bd336)
  - [x] Install `vitest`, `@vitest/coverage-v8`, `jsdom` (`@vitejs/plugin-react` dropped — see deviation)
  - [x] Confirm no peer-dependency conflicts with React 19.2.4 / Next.js 16.2.1
  - [x] Record installed versions

  **Deviations:**
  - `@vitejs/plugin-react` **not installed.** Its transitive `@rolldown/plugin-babel`
    requires `@babel/core@^8`, conflicting with the tree's v7. The plugin exists only to
    transform JSX for component tests, which `spec.md` places out of scope for this
    track. Deferred to whichever track first adds component tests.
  - `@types/node` upgraded `^20` -> `^24.13.3`. Vitest 5 requires `^22 || >=24`, and the
    project already ran on Node v24.14.0, so the `^20` pin was a pre-existing mismatch
    with the actual runtime. `npx tsc --noEmit` passes clean after the upgrade.

  **Installed:** vitest@5.0.0, @vitest/coverage-v8@5.0.0, jsdom@29.1.1, @types/node@24.13.3

- [x] Task: Create `vitest.config.ts` (c5f5e8d)
  - [x] Resolve the `@/*` alias to match `tsconfig.json` paths
  - [x] Enable globals so tests need no `describe`/`it` imports
  - [x] Define the `node` environment for `lib/`, API and RLS tests
  - [x] Define the `jsdom` environment for future component tests
  - [x] Exclude `node_modules`, `.next`, and `mcp/` from test discovery

  **Refinement:** RLS split into its own project (still the `node` environment) so
  `test:rls` is a `--project rls` selection, and so database tests can carry a 30s
  timeout with `fileParallelism: false` without slowing the fast unit suite.
  RLS tests live in `tests/rls/` rather than colocated — they assert cross-table
  policy behaviour and belong to no single source file.

  **Known limitation:** per the Next.js 16 Vitest guide, async Server Components
  cannot be unit tested; Next recommends E2E, which is out of scope. Record in Phase 4.

- [x] Task: Add npm scripts (8a332af)
  - [x] `test` — single run, honouring `CI=true`
  - [x] `test:watch` — watch mode
  - [x] `test:rls` — tenant-isolation suite only
  - [x] `check` — `lint && tsc --noEmit && npm test`

  **Note:** `test` is defined as `vitest run` so a single non-watch pass is the
  default rather than depending on `CI=true` being set. `CI=true npm test` still
  behaves as `workflow.md` specifies.

  **Known state:** `npm run check` exits 1 on 54 pre-existing lint errors. Shipped as
  specified by explicit decision; cleanup registered as a follow-up track in the
  track index.

- [x] Task: Verify type checking covers test files (87db700)
  - [x] Confirm `.test.ts` files are included in `tsconfig.json` (already covered by `**/*.ts`)
  - [x] Add Vitest global types so `tsc --noEmit` passes on test files
  - [x] Run `npx tsc --noEmit` and confirm it passes

  **Decision:** added `vitest-globals.d.ts` with a `/// <reference types="vitest/globals" />`
  directive rather than `types: ["vitest/globals"]` in tsconfig. The `types` array replaces
  automatic `@types` inclusion, which would have silently dropped Node globals
  (`process`, `Buffer`). The directive is additive. ESLint needed no test override.

- [x] Task: Smoke test proving the harness works (verification only — no code committed)
  - [x] Write a temporary test that **fails**; run it and confirm a red result
  - [x] Invert it to pass; confirm green
  - [x] Confirm `CI=true npm test` exits 0 and does not hang in watch mode
  - [x] Remove the temporary test

  **Evidence:**
  - Red: exit 1, `AssertionError: expected 2 to be 3`, 1 failed | 1 passed
  - Green: exit 0, 2 passed, 140ms
  - The probe also imported via `@/lib/ai/markdownToTiptap`, proving alias resolution
  - Plain `npm test` (no `CI=true`) exited 0 in 1s — confirms `vitest run` does not watch
  - After removal: suite exit 0, `tsc --noEmit` exit 0

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (87db700)

---

## Phase 2: Tenant Isolation Harness and Tests [checkpoint: 4fba681]

The highest-value work in this track. Strict TDD: the harness is built to satisfy tests
that assert isolation.

- [x] Task: Build the two-tenant test harness (Red -> Green) (4222481)
  - [x] **Red:** Write a test asserting the harness yields two authenticated clients for
        two distinct managers, each with a distinct user id
  - [x] Confirm it fails (failed to import `./harness` — module did not exist)
  - [x] **Green:** Implement the helper — create two users, sign both in, return anon
        clients carrying their sessions
  - [x] **CRITICAL:** Use the anon key with real user sessions. Never the service-role
        key, which bypasses RLS and makes every isolation test pass vacuously
  - [x] Implement per-test seeding: team, team member, interaction, action item per manager
        (plus strategic initiative)
  - [x] Implement deterministic teardown so the suite is repeatable without `db:reset`
  - [x] Implement a graceful skip with a clear message when the local stack is unreachable (NFR4)

  **Evidence:** 4 tests pass in 3.87s; two consecutive runs both exit 0; 0 leftover
  test users after runs; with the Supabase CLI off `PATH` the suite reports
  `1 skipped / 4 skipped` and exits 0.

  **Blocker fixed:** `supabase start` failed on a port collision — `[analytics]` was
  left at the default 54327 while every other teamleader port was shifted to 5433x,
  colliding with the user's separate `home-base` stack. Moved to 54337 rather than
  stopping the unrelated project.

  **Also:** `vitest.config.ts` -> `.mts` to clear a Vite CommonJS/ESM warning.

  **Known limitation:** `isStackAvailable()` checks credential readability, not
  database reachability; with `SUPABASE_TEST_*` env vars set it returns true without
  contacting the stack.

- [x] Task: Isolation tests — `profiles`, `teams`, `team_members` (Red -> Green) (747d67e)
  - [x] **Red:** For each table, assert Manager A cannot SELECT, UPDATE, DELETE
        Manager B's rows, nor INSERT a row attributed to Manager B
  - [x] **Red:** Assert Manager A *can* perform all four operations on their own rows
  - [x] Run and confirm results reflect actual policy behaviour
  - [x] **Green:** Fix any RLS policy that fails — policy fixes go in a **new** migration,
        never by editing an applied one

  **Result: no policy bugs found.** `own_teams`, `own_reports` and the three `profiles`
  policies all isolate correctly. No migration required.

  **False-positive guard:** the foreign-INSERT assertion requires error code `42501`
  specifically. The first `profiles` attempt inserted the victim's real id and failed
  with `23505` (duplicate key) — it would have passed while proving nothing about RLS.

  **Documented behaviour:** `profiles` has no DELETE policy, so nobody can delete a
  profile including their own (rows cascade from `auth.users`). Recorded via the
  `ownDeleteAllowed` flag rather than left as an unexplained gap.

- [x] Task: Isolation tests — `interactions`, `action_items`, `embeddings` (Red -> Green) (455058f)
  - [x] Same four negative and four positive assertions per table
  - [x] Pay particular attention to tables isolated *indirectly*, via a join to the owning
        interaction rather than a direct `manager_id`
  - [x] Fix failures in a new migration — **none needed, no bugs found**

  **Extra test added:** personal action items (`interaction_id IS NULL`, migration 034)
  are a second, distinct clause in the policy that no seeded row exercises. A bug there
  would leak every manager's private todo list while all join-based tests still passed.
  Asserted in both directions.

- [x] Task: Isolation tests — `strategic_initiatives` (Red -> Green) (4fba681)
  - [x] Same assertions, including nested initiatives (migration 033)
  - [x] Fix failures in a new migration — **none needed, no isolation bugs found**

  **Finding (integrity, not confidentiality):** `managers_own_initiatives` checks only
  `manager_id`, so manager A can insert a row *they own* whose `parent_id` points into
  manager B's tree. Not a leak — A still cannot read B's rows, asserted explicitly. But
  `parent_id` is `ON DELETE CASCADE`, so B deleting their initiative silently deletes
  A's row. Outside this track's remit (proving and repairing *isolation*); recorded as
  a follow-up. The behaviour is pinned by an assertion so any future fix forces a
  deliberate revisit.

- [x] Task: Prove the harness can fail (AC4) (verification only — no code committed)
  - [x] Temporarily weaken one RLS policy locally
  - [x] Confirm the corresponding test **fails**
  - [x] Restore the policy and confirm the test passes again
  - [x] Record the result — a suite that cannot fail proves nothing

  **Evidence:** `own_teams` was temporarily rewritten from `USING (manager_id = auth.uid())`
  to `USING (true)` on the local database only. The suite failed immediately with
  `AssertionError: teams: LEAK — core-a can SELECT core-b's row: expected [ Array(1) ] to
  deeply equal []` (1 failed | 13 passed). The policy was restored to the exact original
  and the suite returned to 14 passed. No migration file was touched.

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (4fba681)

---

## Phase 3: `lib/` Beachhead Tests [checkpoint: 5296331]

Establishes the two patterns future tracks copy: pure functions, and mocked externals.

- [x] Task: Test `lib/ai/markdownToTiptap.ts` (Red -> Green) (75b74be)
  - [x] **Red:** Tests for `markdownToTiptapJson()` — headings, ordered and unordered
        lists, bold/italic, code blocks, links
  - [x] **Red:** Edge cases — empty string, whitespace only, malformed markdown
  - [x] **Red:** Tests for `chatMessagesToTiptapJson()`
  - [x] Confirm failures are genuine (assertion failures, not import errors)
  - [x] **Green:** Fix any real defects the tests expose; otherwise confirm they pass

  **Result: no defects found.** 23 tests, 156ms.

  **Departure from plan:** links are not supported by the implementation at all —
  `parseInline` handles bold/italic/code only. Rather than assert a non-existent
  feature, links are covered under *known limitations*: `[text](url)` is asserted to
  survive as literal text. If link support is added, the test fails and forces a
  deliberate rewrite. Nested list items are recorded the same way.

- [x] Task: Test `lib/ai/prompts.ts` (Red -> Green) (59c0bdb)
  - [x] **Red:** `extractPlainText()` — nested nodes, empty doc, missing `content`,
        mixed node types
  - [x] **Red:** `formatTeamValues()` — empty array, missing description, missing keywords
  - [x] **Red:** The org-context formatter — partial and fully-populated input
  - [x] **Green:** Fix defects or confirm passing

  **REAL BUG FOUND AND FIXED — the first genuine defect this track has surfaced.**
  `extractPlainText` chose its join separator from the node being traversed rather
  than from what that node's children are, inverting it at every level. Paragraphs
  joined their own inline fragments with `\n`; the doc joined its paragraphs with `""`.

  Before: `"Sam is \nblocked\n on review.Second para."`
  After:  `"Sam is blocked on review.\nSecond para."`

  Any sentence containing bold/italic/code was split mid-clause, and paragraph
  boundaries vanished. That text is the input to six production call sites
  (process-interaction, summarize, action-items, coaching-questions, team-coverage,
  embeddings), so it quietly degraded every AI output and the search vectors.
  Invisible to manual testing, the type checker and lint.

  `formatTeamValues` and `formatOrgContext`: no defects (15 of 20 tests passed first run).

  **Follow-up:** embeddings already stored were generated from the mangled text and
  remain degraded until re-embedded. Recorded in the track index.

- [x] Task: Export and test `chunkText` (FR6) (Red -> Green) (76c1c01)
  - [x] **Red:** Write tests for chunk boundaries, text shorter than one chunk, and empty
        input — these fail because the function is not exported
  - [x] **Green:** Export `chunkText` from `lib/ai/embeddings.ts` — behaviour unchanged
  - [x] Confirm `embedInteraction()` still compiles and behaves identically

  **Result: no defects.** 10 tests. Two deliberate behaviours pinned: fragments of
  =<20 chars are discarded (short notes get no embedding at all), and a single
  sentence over `CHUNK_SIZE` is never split.

- [x] Task: Test `lib/integrations/github.ts` with mocked `fetch` (Red -> Green) (5296331)
  - [x] **Red:** Successful response parsing
  - [x] **Red:** API error response (4xx / 5xx)
  - [x] **Red:** Network failure — `fetch` rejects
  - [x] **Red:** Empty result set
  - [x] **Green:** Implement mocking with `vi.mock` / `vi.stubGlobal`
  - [x] **CRITICAL:** Assert `fetch` was called with the expected URL and headers, proving
        no real network call occurs (NFR3)
  - [x] Document this as the reference pattern for all integration tests

  **Result: no defects** in request construction or parsing. 19 tests.

  **Finding (not fixed):** failure handling is inconsistent — a non-ok HTTP response
  returns `[]`, but a rejected `fetch` (DNS, timeout, offline) propagates to the
  caller. `project-rules.md` requires integrations to degrade gracefully. Left
  unchanged deliberately: swallowing network errors also hides misconfiguration, so
  the right answer is a product decision, not a correctness fix. Pinned by an explicit
  test; recorded as a follow-up.

- [x] Task: Verify suite speed (NFR1) (verification only — no code committed)
  - [x] Time the non-RLS suite; confirm under 10 seconds
  - [x] If slower, investigate before proceeding

  **Result: comfortably within budget.** Three consecutive wall-clock runs of
  `vitest run --project node` (including process startup): 1.53s, 0.85s, 0.89s.
  Well under the 10s NFR1 ceiling, so the suite is usable inside a TDD loop.
  The RLS project is excluded from this measure by design — it does real database
  round-trips and is selected separately via `npm run test:rls`.

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (5296331)

---

## Phase 4: Documentation and Finalisation

- [x] Task: Update `conductor/tech-stack.md` (d1c8fb9)
  - [x] Change Vitest from "decided, not yet installed" to installed, with version
  - [x] Replace the "Testing Position" note about it not being installed
  - [x] Confirm the E2E exclusion still reads as deliberate

  Also added the three-project table, the npm commands, a Testing Conventions section,
  and a Known Testing Limitations section (async Server Components, blocked component
  testing, `check` exiting 1).

- [x] Task: Update `README.md` (37ed352)
  - [x] Add a Testing section — `npm test`, `npm run test:watch`, `npm run check`
  - [x] Document the `supabase start` prerequisite for RLS tests
  - [x] Note that RLS tests skip gracefully without a local stack

  **Observation:** the rest of `README.md` is still unmodified create-next-app
  boilerplate — no mention of TeamLeader, Supabase, or the required environment
  variables. Out of scope here; worth a small docs track alongside the
  `ARCHITECTURE.md` drift recorded during setup.

- [x] Task: Document the testing conventions (9c03a6d)
  - [x] Colocation as `<name>.test.ts`
  - [x] Never call real third-party APIs
  - [x] Never use the service-role key in isolation tests
  - [x] Priority order for what to test next

  Recorded in three places for three readers: `README.md` (a human cloning the repo),
  `conductor/tech-stack.md` (an agent loading project context), and
  `code_styleguides/project-rules.md` (an agent writing code — the file the quality
  gates point at). Added two rules learned in Phase 2: assert *zero rows affected*
  rather than an error for blocked reads/writes, and assert error code `42501`
  specifically on a blocked INSERT.

- [x] Task: Full verification against acceptance criteria (verification only)
  - [x] `CI=true npm test` exits 0
  - [x] `npm run check` runs all three gates in sequence
  - [x] `npx tsc --noEmit` passes with test files included
  - [x] `npm run lint` passes on test files
  - [x] Walk every acceptance criterion in `spec.md` and confirm it is met

  | AC | Criterion | Result |
  |---|---|---|
  | 1 | `CI=true npm test` exits 0 | PASS — 8 files, 86 tests, exit 0 |
  | 2 | `npm run check` sequences lint, types, tests | PASS as specified — sequences correctly; exits 1 at lint on the 54 pre-existing errors, the agreed state |
  | 3 | 7 core tables proven isolated | PASS — profiles, teams, team_members, interactions, action_items, embeddings, strategic_initiatives |
  | 4 | Breaking a policy makes a test fail | PASS — verified in Phase 2; `own_teams` weakened to `USING (true)` produced `teams: LEAK — core-a can SELECT core-b's row` |
  | 5 | Both testing patterns demonstrated | PASS — pure functions (markdownToTiptap, prompts, embeddings) and mocked external (`github.test.ts`, `vi.stubGlobal`) |
  | 6 | `chunkText` exported and tested | PASS — exported, 10 tests |
  | 7 | Non-RLS suite under 10s | PASS — 0.96s wall clock |
  | 8 | `tsc --noEmit` passes with tests included | PASS — exit 0 |
  | 9 | Docs reflect installed state | PASS — tech-stack.md, README.md and project-rules.md updated; no stale "not yet installed" text remains |

- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
