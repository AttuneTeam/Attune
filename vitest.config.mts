import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/** Never discovered as tests, in any project. */
const sharedExclude = [
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "mcp/**",
  "conductor/**",
];

/**
 * `@/*` maps to the repo root, mirroring `paths` in tsconfig.json.
 * Kept in sync by hand rather than via vite-tsconfig-paths — a single
 * alias is not worth an extra dependency.
 */
const alias = { "@": root };

export default defineConfig({
  test: {
    // `describe` / `it` / `expect` are available without importing them.
    globals: true,
    // The jsdom project has no files yet; without this an empty project fails the run.
    passWithNoTests: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          globals: true,
          environment: "node",
          // Pure logic and route handlers, colocated beside their source.
          include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
          exclude: sharedExclude,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "rls",
          globals: true,
          environment: "node",
          // Tenant-isolation tests are not tied to one source file, so they
          // live together rather than colocated.
          include: ["tests/rls/**/*.test.ts"],
          exclude: sharedExclude,
          // Each test signs in two users and round-trips real database calls
          // against the local Supabase stack, so the default 5s is too tight.
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // Shared database state — parallel tenants would interfere.
          fileParallelism: false,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "jsdom",
          globals: true,
          environment: "jsdom",
          // Configured for future component tests. No files yet: this track
          // does not add them (see spec.md, Out of Scope).
          include: ["components/**/*.test.tsx", "app/**/*.test.tsx"],
          exclude: sharedExclude,
        },
      },
    ],
  },
});
