# Track: Install Vitest and Establish Initial Test Suite

**ID:** `vitest-setup_20260906`
**Type:** Chore
**Status:** New

## Documents

-   [Specification](./spec.md)
-   [Implementation Plan](./plan.md)
-   [Metadata](./metadata.json)

## Project Context

-   [Project Index](../../index.md)

## Follow-up Tracks

Identified during implementation, to be planned separately:

-   **Clear the ESLint debt.** `npm run check` exits 1 because the codebase carries 54
    pre-existing lint errors (33 `@typescript-eslint/no-explicit-any`, 9
    `react/no-unescaped-entities`, 7 setState-within-effect, 5 refs/impure-function
    during render). By explicit decision the gate ships as specified and stays red until
    this is cleared — an honest signal is what drives the cleanup.
-   **Gate deployment on tests.** `.github/workflows/deploy.yml` runs no tests. Merging
    to `main` deploys straight to production with no staging (see Accepted Risks in
    `spec.md`).
-   **Component testing.** The `jsdom` project is configured but empty. Adding it
    requires resolving the `@vitejs/plugin-react` / `@babel/core@^8` peer conflict.
