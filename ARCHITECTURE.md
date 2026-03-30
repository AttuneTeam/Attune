# Architecture

TeamLeader is a Next.js internal tool for a Head of Engineering to manage 1-on-1 meetings with direct reports — rich text notes, AI summarisation/action items/coaching questions, and semantic search across meeting history.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript, Turbopack) |
| Styling | Tailwind CSS + shadcn/ui v4 |
| UI primitives | `@base-ui/react` (not radix-ui) |
| Database | Supabase (Postgres + pgvector) |
| Auth | Supabase magic-link |
| Editor | Tiptap v3 + tiptap-markdown |
| AI | OpenAI gpt-4o via `@ai-sdk/openai` |
| Charts | recharts |
| Dates | date-fns |
| Toasts | sonner |
| Icons | lucide-react |

---

## Critical gotchas

- **`proxy.ts` not `middleware.ts`** — Next.js renamed middleware to proxy in this version.
- **shadcn Button** uses `@base-ui/react/button` — no `asChild` prop; use `render` prop: `<Button render={<Link href="..." />}>`.
- **Select `onValueChange`** signature is `(value: string | null, eventDetails) => void` — must handle null.
- **DialogTrigger** uses render prop: `<DialogTrigger render={<Button>...</Button>} />`.
- **No `Database` generic on Supabase client** — hand-written types in `lib/supabase/types.ts` don't match the v2.100 generated format.
- **OpenAI client must be created inside route handlers**, not at module level.
- **Tiptap v3 BubbleMenu** is imported from `@tiptap/react/menus`, not `@tiptap/react`. The React component registers its own ProseMirror plugin dynamically — no need to add it to the extensions array.
- **`params` and `searchParams`** in App Router pages are Promises — always `await params`.

---

## File map

```
app/
  (auth)/login/page.tsx               Magic link login
  (dashboard)/
    layout.tsx                        Sidebar nav
    page.tsx                          Dashboard (sentiment overview, recent meetings)
    meetings/
      page.tsx                        Meeting list + semantic search + member filter
      [id]/page.tsx                   Meeting editor (server component, loads data)
    team/
      page.tsx                        Team members list
      [id]/page.tsx                   Individual member profile
  api/ai/
    summarize/route.ts                POST → GPT-4o → summary, sentiment, key_themes
    action-items/route.ts             POST → GPT-4o → extract action items
    coaching-questions/route.ts       POST → GPT-4o → coaching question suggestions
    search/route.ts                   POST → embed query → pgvector similarity search

components/
  editor/
    TiptapEditor.tsx                  Core editor: useEditor, auto-save (1.5s debounce), word count
    FloatingAIMenu.tsx                Always-visible AI toolbar: Summarize / Extract items / Coaching Q's
    FormattingBubbleMenu.tsx          Selection bubble: Bold/Italic/Strike/Code/H1-H3/Lists
  meetings/
    MeetingCard.tsx                   List card: title, member, date, sentiment badge, AI summary
    MeetingEditorClient.tsx           Full editor layout: header, title input, summary bar, editor, sidebar
    ActionItemsSidebar.tsx            Collapsible sidebar: action items by status, inline creation
    SemanticSearch.tsx                Semantic search UI (calls /api/ai/search)
  team/
    MemberCard.tsx                    Team member list card
  ui/                                 shadcn/ui component files

lib/
  supabase/
    client.ts                         Browser Supabase client (Client Components)
    server.ts                         Server Supabase client (RSC / route handlers)
    types.ts                          Hand-written row types
  ai/
    prompts.ts                        System prompts + extractPlainText() from Tiptap JSON
    embeddings.ts                     Chunk notes (500 chars), create + store pgvector embeddings

supabase/migrations/
  001_schema.sql                      All tables
  002_rls.sql                         Row-level security (managers see only their own data)
  003_functions.sql                   match_documents() pgvector cosine-similarity function
  004_meeting_title.sql               ALTER TABLE meetings ADD COLUMN title text

proxy.ts                              Auth session refresh (Next.js renamed middleware → proxy)
```

---

## Database schema

```
profiles          id (= auth.users.id), full_name, avatar_url
  └─ teams        id, name, manager_id → profiles
       └─ team_members   id, team_id, name, level, role_description
            └─ meetings  id, participant_id → team_members, manager_id → profiles,
                          scheduled_at, title (nullable),
                          raw_json_notes (jsonb — Tiptap JSON),
                          ai_summary, sentiment_score (-1..1), key_themes (text[])
                 └─ action_items   id, meeting_id, description,
                                    status (open|in_progress|done), due_date, assignee_id
                 └─ embeddings     id, meeting_id, content (text chunk),
                                    content_vector (vector(1536))
```

---

## Editor architecture

```
MeetingEditorClient          owns all meeting state (summary, sentiment, themes, action items, title)
  ├─ header                  member name + editable date
  ├─ title <input>           inline-editable, saves on blur
  ├─ AI summary bar          shown after summarisation
  ├─ TiptapEditor
  │    ├─ FormattingBubbleMenu   appears on text selection (Bold/Italic/etc.)
  │    ├─ FloatingAIMenu         always-visible toolbar (AI actions)
  │    └─ EditorContent
  └─ ActionItemsSidebar      collapsible, grouped by status
```

---

## AI data flow

```
Summarize
  POST /api/ai/summarize { meetingId }
  → extractPlainText(raw_json_notes) → GPT-4o
  → UPDATE meetings (ai_summary, sentiment_score, key_themes)
  → async: chunk text → embed → store in embeddings table

Extract items
  POST /api/ai/action-items { meetingId }
  → GPT-4o → INSERT action_items rows
  → client re-fetches action items

Semantic search
  POST /api/ai/search { query }
  → embed query with text-embedding-ada-002
  → match_documents() RPC (cosine similarity, top 8)
```

---

## Setup

1. Create Supabase project and enable the `pgvector` extension
2. Run migrations in order: `001` → `002` → `003` → `004`
3. Copy `.env.local.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
4. `npm run dev`
