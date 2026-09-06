# Technology Stack: TeamLeader

> **This is not the Next.js you know.** Next.js 16 introduced breaking changes to
> APIs, conventions, and file structure. Consult `node_modules/next/dist/docs/` before
> writing framework code — do not rely on prior knowledge of the App Router.

---

## Core

| Layer | Choice | Version |
|---|---|---|
| Language | TypeScript (`strict: true`, target ES2017, `moduleResolution: bundler`) | ^5 |
| Framework | Next.js — App Router, Turbopack | 16.2.1 |
| UI runtime | React / React DOM | 19.2.4 |
| Package manager | npm | — |

## Frontend

| Concern | Choice |
|---|---|
| Styling | Tailwind CSS v4 — CSS-first config via `@theme inline` in `app/globals.css` |
| Prose | `@tailwindcss/typography` |
| Component library | shadcn/ui v4 |
| UI primitives | **`@base-ui/react` — not Radix** |
| Icons | lucide-react |
| Charts | recharts |
| Dates | date-fns |
| Toasts | sonner |
| Command palette | cmdk |
| Theming | next-themes — light + olive dark |
| Variants | class-variance-authority, clsx, tailwind-merge |
| Editor | Tiptap v3 + tiptap-markdown (starter-kit, bubble-menu, character-count, placeholder) |
| Markdown render | react-markdown + remark-gfm |

## Backend & Data

| Concern | Choice |
|---|---|
| Database | Supabase — PostgreSQL with the `pgvector` extension |
| Migrations | Supabase CLI, `supabase/migrations/` — sequential, numbered, applied in order |
| Isolation | PostgreSQL Row-Level Security |
| Auth | Supabase magic-link + Google OAuth, via `@supabase/ssr` |
| Session refresh | `proxy.ts` at the repo root |
| Validation | Zod v4 |

## AI

| Concern | Choice |
|---|---|
| Orchestration | Vercel AI SDK v6 (`ai`) — `streamText`, tool-calling agent loops |
| Provider | OpenAI via `@ai-sdk/openai`, plus the `openai` SDK directly |
| Model | GPT-4o |
| Embeddings | `text-embedding-ada-002` -> `vector(1536)` |
| Retrieval | `match_documents()` RPC — pgvector cosine similarity |

## Integrations

Google Calendar - GitHub - Slack - Jira - Confluence - Trello - Cursor

Adapters live in `lib/integrations/` behind a shared interface in `types.ts`.
Credentials are stored **per tenant**, never as shared environment configuration.

## Quality & Tooling

| Concern | Choice |
|---|---|
| Linting | ESLint 9 with `eslint-config-next` |
| Type checking | `tsc --noEmit` (Next.js build) |
| Unit / integration tests | **Vitest** — *decided, not yet installed* |
| E2E tests | None — deliberate exclusion |

### Testing Position

**Vitest** is the chosen test runner: it consumes the existing TypeScript and ESM
configuration natively, requires no Babel or transform layer, and runs fast enough to
sit inside a TDD loop.

It is **not yet installed.** Adding it is a prerequisite chore before the workflow's
test-first requirements can be met — see `workflow.md`.

**End-to-end testing is deliberately out of scope.** No Playwright, no Cypress. UI flows
are verified manually. Consequently, Vitest coverage must carry more weight on the
things that cannot be caught by eye:

- **RLS and multi-tenant isolation** — the highest-value target. A tenant-leak bug in a
  commercial SaaS is a business-ending defect and is invisible in single-user manual testing.
- Pure logic in `lib/` — prompt construction, embeddings chunking, integration adapters,
  markdown/Tiptap conversion
- API route handlers — auth guards, input validation, error paths
- Data transforms feeding charts and rollups

## Deployment

| Stage | Mechanism |
|---|---|
| Hosting | Vercel |
| Trigger | Push to `main` |
| Pipeline | GitHub Actions (`.github/workflows/deploy.yml`) -> `supabase db push` -> Vercel deploy hook |
| Environments | Production only |

**Migrations run before the application deploys.** All schema changes must therefore be
backwards-compatible with the currently deployed application code, since there is a
window where the new schema is live against the old app.

## Environment Variables

`NEXT_PUBLIC_SUPABASE_URL` - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - `OPENAI_API_KEY`
(see `.env.local.example` for the full list)

## Framework Gotchas

These are Next.js 16 / `@base-ui` behaviours that break code written from memory:

- **`proxy.ts`, not `middleware.ts`** — middleware was renamed.
- **`params` and `searchParams` are Promises** — always `await params` in pages.
- **No `asChild` on `Button`** — `@base-ui/react` uses a `render` prop:
  `<Button render={<Link href="..." />}>`
- **`DialogTrigger`** likewise uses `render`: `<DialogTrigger render={<Button/>} />`
- **`Select onValueChange`** is `(value: string | null, eventDetails) => void` — the
  null case must be handled.
- **Tiptap v3 `BubbleMenu`** imports from `@tiptap/react/menus`, not `@tiptap/react`,
  and registers its own ProseMirror plugin — do not add it to the extensions array.
- **The OpenAI client must be constructed inside route handlers**, never at module level.
- **No `Database` generic on the Supabase client** — row types are hand-written in
  `lib/supabase/types.ts`.

## Excluded from the build

`mcp/` is excluded in `tsconfig.json` and is not part of the application build.
