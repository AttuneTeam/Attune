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

## Phase 2: Tenant Isolation Harness and Tests

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

- [ ] Task: Isolation tests — `strategic_initiatives` (Red -> Green)
  - [ ] Same assertions, including nested initiatives (migration 033)
  - [ ] Fix failures in a new migration

- [ ] Task: Prove the harness can fail (AC4)
  - [ ] Temporarily weaken one RLS policy locally
  - [ ] Confirm the corresponding test **fails**
  - [ ] Restore the policy and confirm the test passes again
  - [ ] Record the result — a suite that cannot fail proves nothing

- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

---

## Phase 3: `lib/` Beachhead Tests

Establishes the two patterns future tracks copy: pure functions, and mocked externals.

- [ ] Task: Test `lib/ai/markdownToTiptap.ts` (Red -> Green)
  - [ ] **Red:** Tests for `markdownToTiptapJson()` — headings, ordered and unordered
        lists, bold/italic, code blocks, links
  - [ ] **Red:** Edge cases — empty string, whitespace only, malformed markdown
  - [ ] **Red:** Tests for `chatMessagesToTiptapJson()`
  - [ ] Confirm failures are genuine (assertion failures, not import errors)
  - [ ] **Green:** Fix any real defects the tests expose; otherwise confirm they pass

- [ ] Task: Test `lib/ai/prompts.ts` (Red -> Green)
  - [ ] **Red:** `extractPlainText()` — nested nodes, empty doc, missing `content`,
        mixed node types
  - [ ] **Red:** `formatTeamValues()` — empty array, missing description, missing keywords
  - [ ] **Red:** The org-context formatter — partial and fully-populated input
  - [ ] **Green:** Fix defects or confirm passing

- [ ] Task: Export and test `chunkText` (FR6) (Red -> Green)
  - [ ] **Red:** Write tests for chunk boundaries, text shorter than one chunk, and empty
        input — these fail because the function is not exported
  - [ ] **Green:** Export `chunkText` from `lib/ai/embeddings.ts` — behaviour unchanged
  - [ ] Confirm `embedInteraction()` still compiles and behaves identically

- [ ] Task: Test `lib/integrations/github.ts` with mocked `fetch` (Red -> Green)
  - [ ] **Red:** Successful response parsing
  - [ ] **Red:** API error response (4xx / 5xx)
  - [ ] **Red:** Network failure — `fetch` rejects
  - [ ] **Red:** Empty result set
  - [ ] **Green:** Implement mocking with `vi.mock` / `vi.stubGlobal`
  - [ ] **CRITICAL:** Assert `fetch` was called with the expected URL and headers, proving
        no real network call occurs (NFR3)
  - [ ] Document this as the reference pattern for all integration tests

- [ ] Task: Verify suite speed (NFR1)
  - [ ] Time the non-RLS suite; confirm under 10 seconds
  - [ ] If slower, investigate before proceeding

- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

---

## Phase 4: Documentation and Finalisation

- [ ] Task: Update `conductor/tech-stack.md`
  - [ ] Change Vitest from "decided, not yet installed" to installed, with version
  - [ ] Replace the "Testing Position" note about it not being installed
  - [ ] Confirm the E2E exclusion still reads as deliberate

- [ ] Task: Update `README.md`
  - [ ] Add a Testing section — `npm test`, `npm run test:watch`, `npm run check`
  - [ ] Document the `supabase start` prerequisite for RLS tests
  - [ ] Note that RLS tests skip gracefully without a local stack

- [ ] Task: Document the testing conventions
  - [ ] Colocation as `<name>.test.ts`
  - [ ] Never call real third-party APIs
  - [ ] Never use the service-role key in isolation tests
  - [ ] Priority order for what to test next

- [ ] Task: Full verification against acceptance criteria
  - [ ] `CI=true npm test` exits 0
  - [ ] `npm run check` runs all three gates in sequence
  - [ ] `npx tsc --noEmit` passes with test files included
  - [ ] `npm run lint` passes on test files
  - [ ] Walk every acceptance criterion in `spec.md` and confirm it is met

- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
