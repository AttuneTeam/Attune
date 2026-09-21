# Spec: Install Vitest and Establish Initial Test Suite

**Type:** Chore
**Status:** New

---

## Overview

TeamLeader has no test framework. `tech-stack.md` names Vitest as the chosen runner but
records it as *"decided, not yet installed"*, while `workflow.md` makes test-first
development mandatory for logic in `lib/`, API route handlers, and anything touching
tenant isolation. Every future track therefore stalls at its first Red-phase step.

This chore closes that gap: it installs and configures Vitest, establishes a real
tenant-isolation test harness against a local Supabase stack, and adds a beachhead of
`lib/` tests that demonstrate both testing patterns the codebase needs — pure functions
and mocked external services.

### Why tenant isolation is the priority

TeamLeader is commercial multi-tenant SaaS. All 26 tables have RLS *enabled*, but
"enabled" is not "correct" — no test currently proves that manager A cannot read manager
B's data. This class of defect is:

- **Invisible to manual testing**, which is always performed as a single logged-in user
- **Invisible to type checking and linting**
- **Business-ending** if it reaches production

It is the highest-value thing this codebase can test, and nothing else currently guards it.

---

## Functional Requirements

### FR1 — Vitest installed and configured

- Add `vitest` and supporting dev dependencies.
- Create `vitest.config.ts` resolving the `@/*` path alias to match `tsconfig.json`.
- Configure two projects/environments:
  - **`node`** — for `lib/` logic, API handlers, and RLS tests
  - **`jsdom`** — available for future component tests (configured, not yet used)
- Tests are colocated as `<name>.test.ts` beside their source.
- Vitest globals enabled so tests need no `describe`/`it` imports.

### FR2 — npm scripts

| Script | Behaviour |
|---|---|
| `npm test` | Runs the suite. Honours `CI=true` for a single non-watch run (`workflow.md` invokes `CI=true npm test`) |
| `npm run test:watch` | Watch mode for local development |
| `npm run test:rls` | Runs only the tenant-isolation suite |
| `npm run check` | `lint && tsc --noEmit && CI=true npm test` — the pre-commit gate |

### FR3 — Tenant isolation harness

- A test helper that provisions **two distinct manager accounts** (Manager A, Manager B)
  against the local Supabase stack, each with an authenticated client.
- Seeds each manager with their own team, team member, interaction, and action item.
- Cleans up deterministically so the suite is repeatable without a manual DB reset.
- Uses the **anon key with a real user session** — never the service-role key, which
  bypasses RLS and would make every test pass vacuously.

### FR4 — Tenant isolation tests

For each core tenant-scoped table — `profiles`, `teams`, `team_members`, `interactions`,
`action_items`, `embeddings`, `strategic_initiatives` — assert that Manager A:

- **cannot SELECT** Manager B's rows (returns empty, not an error)
- **cannot UPDATE** Manager B's rows
- **cannot DELETE** Manager B's rows
- **cannot INSERT** a row attributed to Manager B
- **can** perform all four operations on their own rows

The positive cases matter as much as the negative ones: a policy that blocks everything
would otherwise pass a purely negative suite.

### FR5 — `lib/` beachhead tests

Three modules, chosen to establish both patterns future tracks will copy:

**Pure functions — no mocking**
- `lib/ai/markdownToTiptap.ts` — `markdownToTiptapJson()` and
  `chatMessagesToTiptapJson()`: headings, lists, emphasis, code blocks, links, empty
  input, and malformed markdown.
- `lib/ai/prompts.ts` — `extractPlainText()` against Tiptap JSON (nested nodes, empty
  docs, missing content), plus the `formatTeamValues()` / org-context formatters.

**Mocked external service**
- `lib/integrations/github.ts` — with `fetch` mocked: success parsing, API error
  responses, network failure, and empty results. Establishes the rule that **no test
  ever calls a real third-party API**.

### FR6 — Export `chunkText`

`chunkText` in `lib/ai/embeddings.ts` is currently module-private and therefore
untestable. Export it and add tests for chunk boundaries, short input, and empty input.
This is a minimal, behaviour-preserving change.

### FR7 — Documentation

- Update `tech-stack.md`: Vitest moves from *"decided, not yet installed"* to installed,
  with the version recorded.
- Add a testing section to `README.md`: how to run the suite, and the local-Supabase
  prerequisite for RLS tests.

---

## Non-Functional Requirements

- **NFR1 — Speed.** The non-RLS suite must complete in under 10 seconds so it can sit
  inside a TDD loop.
- **NFR2 — Isolation.** No test depends on production data or on another test's state.
- **NFR3 — No real network calls.** Every external service (OpenAI, GitHub, Slack,
  Google Calendar) is mocked.
- **NFR4 — Graceful skip.** If the local Supabase stack is not running, RLS tests skip
  with a clear message rather than failing with an obscure connection error.
- **NFR5 — Type safety.** Test files are type-checked. No `any`, no `@ts-ignore`.

---

## Acceptance Criteria

1. `CI=true npm test` runs the full suite and exits 0.
2. `npm run check` runs lint, type check and tests in sequence.
3. The RLS suite proves, for all seven core tables, that one manager cannot read or
   mutate another manager's rows — and can operate on their own.
4. Deliberately breaking one RLS policy makes the corresponding test **fail**. *(This is
   the proof the harness works — a test that cannot fail is not a test.)*
5. `lib/` beachhead tests pass and demonstrate both the pure-function and
   mocked-external patterns.
6. `chunkText` is exported and tested.
7. The non-RLS suite completes in under 10 seconds.
8. `npx tsc --noEmit` passes with the test files included.
9. `tech-stack.md` and `README.md` reflect the installed state.

---

## Out of Scope

- **E2E testing.** No Playwright, no Cypress — explicitly excluded in `tech-stack.md`.
- **Component testing.** The jsdom environment is configured for future use, but no
  React component tests are written in this track.
- **CI integration.** `.github/workflows/deploy.yml` is left unchanged (see Accepted
  Risks).
- **Coverage thresholds.** No enforced percentage gate; priority-based coverage is the
  policy, not a number.
- **Backfilling the whole codebase.** API route handlers and data transforms are
  deliberately deferred to later tracks.
- **Refactoring for testability**, beyond the single `chunkText` export.

---

## Accepted Risks

**Tests do not gate deployment.** By explicit decision, CI is unchanged. Merging to
`main` pushes migrations and deploys to production with no staging environment, so a
regression that a passing local suite would have caught can still reach users if tests
are not run before merging. `npm run check` before merge is the compensating control,
and it is a manual one. Revisiting this is a good candidate for a follow-up track.

---

## Dependencies

- Docker (for `supabase start`)
- Supabase CLI
- No blocking dependencies on other tracks — this one unblocks the rest.
