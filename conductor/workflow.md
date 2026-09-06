# Project Workflow: TeamLeader

## Guiding Principles

1.  **The Plan is the Source of Truth:** All work must be tracked in `plan.md`.
2.  **The Tech Stack is Deliberate:** Changes to the tech stack must be documented in
    `tech-stack.md` *before* implementation.
3.  **Test-First Where Testable:** Logic, API routes, and anything touching tenant
    isolation are developed test-first. UI work is verified manually against an explicit
    checklist. See **Testing Requirements** below.
4.  **Tenant Isolation is Non-Negotiable:** This is multi-tenant commercial SaaS. Every
    new table gets RLS in the same migration that creates it.
5.  **User Experience First:** Every decision is judged against `product-guidelines.md`.
6.  **Non-Interactive & CI-Aware:** Prefer non-interactive commands. Use `CI=true` for
    watch-mode tools so they run once and exit.

---

## Task Workflow

All tasks follow a strict lifecycle.

### Standard Task Workflow

1.  **Select Task:** Choose the next available task from `plan.md` in sequential order.

2.  **Mark In Progress:** Before beginning work, edit `plan.md` and change the task from
    `[ ]` to `[~]`.

3.  **Classify the Task:** Determine which track it follows:

    -   **Testable** — logic in `lib/`, API route handlers, data transforms, database
        migrations, RLS policies, integration adapters. → Follow steps 4a–4c (TDD).
    -   **Visual/UI** — components, layout, styling, interaction states.
        → Follow step 4d (manual verification).

    A task that spans both is split: the logic is developed test-first, the UI on top of
    it is verified manually.

4.  **Implement:**

    **4a. Write Failing Tests (Red Phase)** *(testable tasks)*
    -   Create a test file colocated as `<name>.test.ts` beside the source.
    -   Write tests defining the expected behaviour and acceptance criteria.
    -   **CRITICAL:** Run them and confirm they fail. Do not proceed without a red test.
    -   *If Vitest is not yet installed, installing and configuring it is itself a
        prerequisite task and must be completed first — do not skip the test step.*

    **4b. Implement to Pass (Green Phase)** *(testable tasks)*
    -   Write the minimum code needed to make the failing tests pass.
    -   Run the suite and confirm all tests pass.

    **4c. Refactor** *(testable tasks, recommended)*
    -   With passing tests as a safety net, improve clarity and remove duplication.
    -   Rerun tests.

    **4d. Implement with Manual Verification** *(visual/UI tasks)*
    -   Implement the change.
    -   Verify against this checklist before proceeding:
        -   [ ] Correct in **light** theme
        -   [ ] Correct in **olive dark** theme
        -   [ ] Responsive — mobile, tablet, desktop
        -   [ ] Uses theme tokens, no literal hex values
        -   [ ] No 1px dividers or `<hr>`; boundaries via surface shift or whitespace
        -   [ ] Keyboard accessible; focus states visible
        -   [ ] Loading and empty states handled
    -   Extract any non-trivial logic into a tested helper rather than leaving it in the
        component.

5.  **Verify Quality Gates:** See **Quality Gates** below. Run lint and type checks.

6.  **Document Deviations:** If the implementation diverges from `tech-stack.md`:
    -   **STOP** implementation.
    -   Update `tech-stack.md` with the new design and a dated note explaining why.
    -   Resume implementation.

7.  **Commit Code Changes:**
    -   Stage all changes related to the task.
    -   Commit with a conventional message, e.g.
        `feat(interactions): Add initiative signal extraction`.

8.  **Attach Task Summary with Git Notes:**
    -   **8.1** Get the commit hash: `git log -1 --format="%H"`.
    -   **8.2** Draft a summary: task name, what changed, files created/modified, and
        the core *why*.
    -   **8.3** Attach it: `git notes add -m "<note content>" <commit_hash>`.

9.  **Record the Task SHA:**
    -   Update `plan.md`: change the task from `[~]` to `[x]` and append the first 7
        characters of the commit hash.

10. **Commit Plan Update:**
    -   Stage `plan.md` and commit as
        `conductor(plan): Mark task '<TASK NAME>' as complete`.

### Task Correction & Plan Amendment

1.  **In-Flight Refinements:** Minor gaps found while a task is `[~]` are fixed directly
    in the active stream before committing.
2.  **Code Review Corrections:** Ask for a review (*"run a review"*). The review agent
    appends a `Review Fixes` phase to `plan.md` so corrections stay tracked.
3.  **Logical State Reversions:** Ask to revert (*"revert the last task"*). This rolls
    back the associated commits and resets the task to `[ ]` for a clean restart.

---

## Phase Completion Protocol

Executed immediately after a task completes that also concludes a phase.

1.  **Announce Protocol Start.**

2.  **Ensure Coverage for Phase Changes:**
    -   **2.1** Find the previous phase's checkpoint SHA in `plan.md`. If none, scope is
        all changes since the first commit.
    -   **2.2** `git diff --name-only <previous_checkpoint_sha> HEAD`.
    -   **2.3** For each **testable** file in that list (exclude `.json`, `.md`, `.css`,
        `.sql`, and presentational `.tsx` components), verify a test file exists. If one
        is missing, create it — first reading existing tests to match naming and style.

3.  **Execute Automated Tests:**
    -   Announce the exact command before running it.
        **Command:** `CI=true npm test`
    -   Also run: `npm run lint` and `npx tsc --noEmit`.
    -   If tests fail, debug and propose a fix a **maximum of two times**. If they still
        fail, **stop**, report the failure, and ask for guidance.

4.  **Propose a Manual Verification Plan:**
    -   Analyse `product.md`, `product-guidelines.md` and `plan.md` to determine the
        phase's user-facing goals.
    -   Present concrete steps with expected outcomes, e.g.:

        ```
        The automated tests have passed. For manual verification:

        1. Start the dev server: npm run dev
        2. Open: http://localhost:3000/team
        3. Confirm: each member card shows the latest sentiment badge,
           and the layout is correct in both light and dark themes.
        ```

5.  **Await Explicit User Feedback:**
    -   Ask: "**Does this meet your expectations? Please confirm with yes or provide
        feedback on what needs to be changed.**"
    -   **PAUSE.** Do not proceed without explicit confirmation.

6.  **Identify Target Commit:** Use the last functional commit of the phase. Do **not**
    create an empty commit for checkpointing.

7.  **Attach Verification Report via Git Notes:** Include the test command run, the
    manual verification steps, and the user's confirmation.

8.  **Record Phase Checkpoint SHA:** Append `[checkpoint: <sha>]` to the phase heading
    in `plan.md`.

9.  **Commit Plan Update:** `conductor(plan): Mark phase '<PHASE NAME>' as complete`.

10. **Announce Completion.**

---

## Quality Gates

Before marking any task complete:

### Always
-   [ ] `npm run lint` passes with no errors
-   [ ] `npx tsc --noEmit` passes — no `any`, no `@ts-ignore`
-   [ ] Code follows `code_styleguides/`, including `project-rules.md`
-   [ ] No hardcoded secrets; no secrets in client-side code
-   [ ] External input (request bodies, integration responses, AI output) validated with Zod
-   [ ] Documentation updated if behaviour changed

### For testable changes
-   [ ] Tests written before implementation and now passing
-   [ ] Both success and failure paths covered

### For UI changes
-   [ ] Correct in light **and** olive dark themes
-   [ ] Responsive across mobile, tablet, desktop
-   [ ] Theme tokens used, no literal hex values
-   [ ] No 1px dividers; boundaries via surface shift or whitespace
-   [ ] Keyboard accessible with visible focus states
-   [ ] Loading and empty states handled

### For database changes
-   [ ] New migration file added; **no existing migration edited**
-   [ ] RLS enabled and policies written for every new table
-   [ ] Backwards-compatible with the currently deployed app (migrations run *before* deploy)
-   [ ] `lib/supabase/types.ts` updated to match

### For AI changes
-   [ ] Prompts live in `lib/ai/prompts.ts`
-   [ ] OpenAI client constructed inside the route handler, not at module level
-   [ ] Structured output validated with Zod before persisting
-   [ ] Failure cannot destroy the manager's written notes
-   [ ] Output honours the AI rules in `product-guidelines.md`

---

## Development Commands

### Setup

```bash
npm install
cp .env.local.example .env.local   # then fill in the values
supabase start                      # local Supabase stack
npm run db:migrate                  # apply migrations
```

### Daily Development

```bash
npm run dev          # dev server on http://localhost:3000
npm run lint         # ESLint
npx tsc --noEmit     # type check
CI=true npm test     # test suite (once Vitest is installed)
```

### Database

```bash
npm run db:migrate   # apply pending migrations
npm run db:reset     # reset local DB and replay all migrations
npm run db:dump      # dump schema
npm run db:sync      # sync from production
```

### Before Committing

```bash
npm run lint && npx tsc --noEmit && CI=true npm test
```

---

## Testing Requirements

### Current State

Vitest is the chosen runner but is **not yet installed**. Installing and configuring it
is a prerequisite chore. There is **no E2E framework** and none is planned — UI flows are
verified manually.

### Priority Order

Because manual verification covers the UI, automated tests should concentrate where
eyes cannot reach:

1.  **RLS and tenant isolation — highest priority.** A tenant leak is a business-ending
    defect and is completely invisible during single-user manual testing. Test that
    manager A cannot read or write manager B's rows.
2.  **Pure logic in `lib/`** — prompt construction, embeddings chunking, markdown/Tiptap
    conversion, integration adapters, persona logic.
3.  **API route handlers** — auth guards, input validation, error paths.
4.  **Data transforms** feeding charts, rollups and briefings.

### Practices

-   Colocate tests as `<name>.test.ts`.
-   Mock external services — OpenAI, GitHub, Slack, Google Calendar. Never call a real
    third-party API from a test.
-   Test both success and failure cases; error paths are where this product degrades.
-   No test may depend on production data.

### Manual Testing

-   Verify every UI change in both light and olive dark themes.
-   Check responsive layouts at mobile, tablet and desktop widths.
-   Touch targets at least 44x44px.
-   Test interaction flows with a real Supabase session, not mocked auth.

---

## Code Review Process

### Self-Review Checklist

1.  **Functionality** — works as specified, edge cases handled, errors are
    user-friendly and match the product voice.
2.  **Code Quality** — follows the style guides, DRY, clear names, comments only where
    the *why* isn't obvious.
3.  **Testing** — tests written for testable code; UI checklist completed.
4.  **Security & Tenancy** — RLS on new tables, no hardcoded secrets, input validated,
    no way for one tenant to reach another's data.
5.  **Performance** — no N+1 Supabase queries, no unnecessary client components, images
    optimised.
6.  **Design Compliance** — theme tokens, no dividers, both themes correct, `tertiary`
    used sparingly.
7.  **Product Compliance** — does not drift into a non-goal from `product.md`; core
    workflows still function with zero integrations connected.

---

## Commit Guidelines

### Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

`feat` · `fix` · `docs` · `style` · `refactor` · `test` · `chore` · `conductor`

### Examples

```bash
git commit -m "feat(initiatives): Extract signals from interaction notes"
git commit -m "fix(editor): Handle null value in Select onValueChange"
git commit -m "chore(db): Add RLS policies for member_personas"
git commit -m "style(sidebar): Use colour-only active state for nav items"
```

---

## Definition of Done

A task is complete when:

1.  Code is implemented to specification.
2.  Tests are written and passing (testable tasks), or the manual verification checklist
    is complete (UI tasks).
3.  Lint and type checks pass.
4.  Quality gates for the change type are satisfied.
5.  Documentation updated if behaviour changed.
6.  Changes committed with a conventional message.
7.  A git note with the task summary is attached to the commit.
8.  `plan.md` is updated with `[x]` and the commit SHA.

---

## Deployment Workflow

Deployment is **automatic on push to `main`** via
`.github/workflows/deploy.yml`: migrations are pushed to Supabase, then a Vercel deploy
hook fires. There is no staging environment.

### Critical Constraint

**Migrations run before the application deploys.** There is a window in which the new
schema is live against the *old* application code. Therefore:

-   Schema changes must be **additive and backwards-compatible**.
-   Renames and drops must be split across two releases: add the new shape, ship the code
    that uses it, then remove the old shape in a later release.
-   Never drop or rename a column in the same release that stops using it.

### Pre-Merge Checklist

-   [ ] All tests passing
-   [ ] No lint or type errors
-   [ ] Migrations are backwards-compatible with the deployed app
-   [ ] RLS policies present on all new tables
-   [ ] New environment variables configured in Vercel **before** merging
-   [ ] Both themes verified
-   [ ] Mobile layout verified

### Post-Deployment

1.  Verify the deployment succeeded in Vercel.
2.  Confirm migrations applied cleanly in Supabase.
3.  Test the critical path — log in, open an interaction, process it.
4.  Check error logs.

---

## Emergency Procedures

### Critical Bug in Production

1.  Branch from `main`.
2.  Write a failing test reproducing the bug where the code is testable.
3.  Implement the minimal fix.
4.  Verify in both themes and on mobile.
5.  Merge to `main` — deployment is automatic.
6.  Document in `plan.md`.

### Tenant Data Leak

Treat as the highest-severity incident this product can have.

1.  Identify the failing RLS policy or query path.
2.  Patch the policy at the database layer first — not in application code.
3.  Determine the scope of exposure from access logs.
4.  Notify affected customers.
5.  Add a regression test asserting the isolation boundary.

### Data Loss

1.  Stop all write operations.
2.  Restore from the latest Supabase backup.
3.  Verify data integrity.
4.  Document the incident and update backup procedures.

### Security Breach

1.  Rotate all secrets immediately — Supabase keys, `OPENAI_API_KEY`, integration
    tokens.
2.  Review access logs.
3.  Patch the vulnerability.
4.  Notify affected users.
5.  Document and update security procedures.

---

## Continuous Improvement

-   Review this workflow when it causes friction, and amend it rather than working
    around it.
-   Keep `ARCHITECTURE.md`, `DESIGN.md` and the `conductor/` documents current — drift
    between docs and code was already found once during setup.
-   Keep things simple and maintainable.
