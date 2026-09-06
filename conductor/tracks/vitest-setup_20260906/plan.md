# Plan: Install Vitest and Establish Initial Test Suite

**Track Type:** Chore
**Spec:** [spec.md](./spec.md)

> Follows `conductor/workflow.md`. Phases 2-4 are strict Red -> Green -> Refactor.
> Phase 1 is infrastructure, verified by a smoke test proving the runner can fail.

---

## Phase 1: Vitest Infrastructure

Establishes the runner. Cannot be test-first — the runner is what runs tests. Verified
instead by proving the harness reports both failure and success.

- [ ] Task: Install Vitest and dependencies
  - [ ] Install `vitest`, `@vitest/coverage-v8`, `jsdom`, `@vitejs/plugin-react`
  - [ ] Confirm no peer-dependency conflicts with React 19.2.4 / Next.js 16.2.1
  - [ ] Record installed versions

- [ ] Task: Create `vitest.config.ts`
  - [ ] Resolve the `@/*` alias to match `tsconfig.json` paths
  - [ ] Enable globals so tests need no `describe`/`it` imports
  - [ ] Define the `node` environment for `lib/`, API and RLS tests
  - [ ] Define the `jsdom` environment for future component tests
  - [ ] Exclude `node_modules`, `.next`, and `mcp/` from test discovery

- [ ] Task: Add npm scripts
  - [ ] `test` — single run, honouring `CI=true`
  - [ ] `test:watch` — watch mode
  - [ ] `test:rls` — tenant-isolation suite only
  - [ ] `check` — `lint && tsc --noEmit && CI=true npm test`

- [ ] Task: Verify type checking covers test files
  - [ ] Confirm `.test.ts` files are included in `tsconfig.json`
  - [ ] Add Vitest global types so `tsc --noEmit` passes on test files
  - [ ] Run `npx tsc --noEmit` and confirm it passes

- [ ] Task: Smoke test proving the harness works
  - [ ] Write a temporary test that **fails**; run it and confirm a red result
  - [ ] Invert it to pass; confirm green
  - [ ] Confirm `CI=true npm test` exits 0 and does not hang in watch mode
  - [ ] Remove the temporary test

- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

---

## Phase 2: Tenant Isolation Harness and Tests

The highest-value work in this track. Strict TDD: the harness is built to satisfy tests
that assert isolation.

- [ ] Task: Build the two-tenant test harness (Red -> Green)
  - [ ] **Red:** Write a test asserting the harness yields two authenticated clients for
        two distinct managers, each with a distinct user id
  - [ ] Confirm it fails
  - [ ] **Green:** Implement the helper — create two users, sign both in, return anon
        clients carrying their sessions
  - [ ] **CRITICAL:** Use the anon key with real user sessions. Never the service-role
        key, which bypasses RLS and makes every isolation test pass vacuously
  - [ ] Implement per-test seeding: team, team member, interaction, action item per manager
  - [ ] Implement deterministic teardown so the suite is repeatable without `db:reset`
  - [ ] Implement a graceful skip with a clear message when the local stack is unreachable (NFR4)

- [ ] Task: Isolation tests — `profiles`, `teams`, `team_members` (Red -> Green)
  - [ ] **Red:** For each table, assert Manager A cannot SELECT, UPDATE, DELETE
        Manager B's rows, nor INSERT a row attributed to Manager B
  - [ ] **Red:** Assert Manager A *can* perform all four operations on their own rows
  - [ ] Run and confirm results reflect actual policy behaviour
  - [ ] **Green:** Fix any RLS policy that fails — policy fixes go in a **new** migration,
        never by editing an applied one

- [ ] Task: Isolation tests — `interactions`, `action_items`, `embeddings` (Red -> Green)
  - [ ] Same four negative and four positive assertions per table
  - [ ] Pay particular attention to tables isolated *indirectly*, via a join to the owning
        interaction rather than a direct `manager_id`
  - [ ] Fix failures in a new migration

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
