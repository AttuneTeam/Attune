This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

[Vitest](https://vitest.dev) is the test runner. There is no end-to-end framework —
UI flows are verified manually.

```bash
npm test          # run everything once
npm run test:watch # watch mode while developing
npm run test:rls   # tenant-isolation suite only
npm run check      # lint + type check + tests
```

### Test projects

| Project | What it covers |
|---|---|
| `node` | Pure logic in `lib/` and route handlers, colocated as `<name>.test.ts` |
| `rls` | Row-Level Security / tenant isolation, in `tests/rls/` |
| `jsdom` | Reserved for component tests (not yet enabled) |

### Running the RLS tests

The tenant-isolation suite runs against a **real local Supabase stack** — mocking the
database would test the mock rather than the policies. Start it first:

```bash
supabase start   # requires Docker
npm run test:rls
```

Without a local stack the RLS tests **skip** with a message rather than failing, so
`npm test` still works on a machine with no Docker.

These tests create two throwaway manager accounts, assert that neither can read or
modify the other's rows across every tenant-scoped table, and delete both afterwards.
They use the anon key with real user sessions — never the service-role key, which
bypasses RLS and would make every assertion pass vacuously.

### Conventions

- Colocate tests as `<name>.test.ts` beside their source (`tests/rls/` is the exception).
- **Never call a real third-party API.** Stub `fetch`; see `lib/integrations/github.test.ts`.
- Cover failure paths, not just success.

> **Note:** `npm run check` currently exits 1 on pre-existing ESLint errors unrelated to
> tests. Type checking and tests are clean.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
