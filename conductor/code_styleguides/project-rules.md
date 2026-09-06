# TeamLeader Project Rules

Project-specific conventions that the generic style guides cannot know. These override
general advice where they conflict, and they exist because each one is a mistake an
agent working from prior knowledge will otherwise make.

---

## 1. Framework — Next.js 16

**Read the docs first.** Next.js 16 has breaking changes from every earlier version.
Before writing framework code, consult `node_modules/next/dist/docs/`. Do not write App
Router code from memory.

- **`proxy.ts`, never `middleware.ts`.** Middleware was renamed. Auth session refresh
  lives in `proxy.ts` at the repo root.
- **`params` and `searchParams` are Promises.** Always `await params` before use.
- **Server Components by default.** Add `"use client"` only where interactivity,
  browser APIs, or hooks genuinely require it — and push it as far down the tree as
  possible. Do not mark a page client just to use one interactive child.
- **Data fetching belongs in Server Components**, not in client-side effects.

## 2. UI Primitives — `@base-ui/react`, not Radix

shadcn/ui here is built on `@base-ui/react`. Radix idioms do not work.

- **No `asChild`.** Use the `render` prop:
  `<Button render={<Link href="/team" />}>Team</Button>`
- **`DialogTrigger` uses `render`:** `<DialogTrigger render={<Button>Open</Button>} />`
- **`Select`'s `onValueChange`** is `(value: string | null, eventDetails) => void`.
  The `null` case must be handled — it is not optional.
- Check an existing component in `components/ui/` before assuming any prop's API.

## 3. Styling

- **Use theme tokens, never literal hex values.** `bg-card`, `text-foreground`,
  `text-primary` — not `bg-[#fcf9f2]`. Tokens are the only thing that makes dark mode work.
- **Every component must be correct in both themes.** Light and olive dark. A component
  verified only in light mode is not finished.
- **No 1px borders to divide the UI**, no `<hr>`, no `border-bottom` between list items.
  Use surface changes or whitespace (see `product-guidelines.md`).
- **No drop shadows for ordinary elevation.** Use tonal layering. Reserve the diffused
  ambient shadow for genuinely floating elements.
- `tertiary` (coral) is reserved for high-priority CTAs and critical data points only.
- Compose classes with `cn()` from `lib/utils`; never concatenate class strings by hand.

## 4. Database & Multi-Tenancy

TeamLeader is multi-tenant commercial SaaS. Tenant isolation is a correctness
requirement, not a feature.

- **Every new table gets Row-Level Security in the same migration that creates it.**
  A table without RLS is a data leak waiting to happen. Never defer it "for now".
- **Never rely on application-level filtering alone for isolation.** A `.eq('manager_id', …)`
  in a query is a convenience, not a security boundary. The database enforces the boundary.
- **Migrations are sequential, numbered, and immutable once merged.** Never edit an
  applied migration; add a new one.
- **Migrations must be backwards-compatible with the deployed app.** CI runs
  `supabase db push` *before* Vercel deploys, so the new schema is briefly live against
  the old application code. Additive changes only; split renames and drops across releases.
- Row types are hand-written in `lib/supabase/types.ts` — there is **no `Database`
  generic** on the Supabase client. Update the types when you change the schema.
- Use `lib/supabase/server.ts` in Server Components and route handlers,
  `lib/supabase/client.ts` in Client Components. Never cross them.

## 5. AI Code

- **Construct the OpenAI client inside route handlers**, never at module level.
- **System prompts live in `lib/ai/prompts.ts`**, not inlined in route handlers.
- **Validate every AI structured output with Zod** before writing it to the database.
  Model output is untrusted input.
- **Never let an AI failure destroy the manager's written content.** Notes are the
  irreplaceable asset; AI output is regenerable.
- Stream reasoning where the manager can see it for agentic flows.
- Follow the AI output rules in `product-guidelines.md` — objective, constructive, never
  judging the person.

## 6. Editor — Tiptap v3

- **`BubbleMenu` imports from `@tiptap/react/menus`**, not `@tiptap/react`. It registers
  its own ProseMirror plugin; do **not** add it to the extensions array.
- Notes are stored as Tiptap JSON in `raw_json_notes`. Use `extractPlainText()` from
  `lib/ai/prompts.ts` to convert for AI consumption — never stringify the JSON directly.
- Auto-save with debounce. No Save button in the primary editing path.

## 7. TypeScript

- `strict: true` is on. **No `any`.** If a type is genuinely unknown, use `unknown` and
  narrow it.
- **No `@ts-ignore`.** If a suppression is truly unavoidable, use `@ts-expect-error`
  with a comment explaining why.
- Import with the `@/*` alias, not deep relative paths.
- Validate all external input — request bodies, integration responses, AI output — with Zod.

## 8. Integrations

- New integrations implement the shared interface in `lib/integrations/types.ts`.
- **Credentials are per tenant**, stored against the manager. Never shared environment config.
- **An integration failure must degrade gracefully.** Every core workflow has to work
  with zero integrations connected — this follows from "any people manager" being the
  primary user.

## 9. Testing

- Vitest is the chosen runner (see `tech-stack.md`). It is **not yet installed** —
  installing it is a prerequisite chore.
- No E2E framework. UI is verified manually.
- Prioritise tests where manual verification cannot reach: **RLS and tenant isolation
  first**, then pure logic in `lib/`, then route-handler auth guards and error paths.

## 10. Copy

- British spelling: `summarise`, `organisation`, `prioritise`, `behaviour`.
- No exclamation marks in product copy. No corporate filler. See `product-guidelines.md`.
