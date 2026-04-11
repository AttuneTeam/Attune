# Seeding Production Data

Capture a snapshot of your live Supabase data and use it to bootstrap a new production environment or reset local dev.

---

## Prerequisites

```bash
brew install supabase/tap/supabase   # if not installed
supabase login                        # once — opens browser
supabase link --project-ref <ref>     # once per machine
```

Find your project ref in the Supabase dashboard URL: `app.supabase.com/project/<ref>`

---

## Step 1 — Dump the data

```bash
npm run db:dump
```

Writes `supabase/seed.sql` with INSERT statements for all `public` schema tables.

**Excluded tables:** `embeddings` and `knowledge_chunks` — these hold 1536-dimension float vectors (~6 KB each). They are large and must be regenerated after seeding anyway (see Step 4).

The file is wrapped in `SET session_replication_role = 'replica'` / `RESET ...` so FK constraints are suspended during bulk insert.

> **Security:** `supabase/seed.sql` is gitignored. The file contains names, emails, and meeting notes — never commit it.

---

## Step 2 — Apply locally

```bash
npm run db:reset
```

Supabase runs all migrations in order, then applies `seed.sql`. Configured in `supabase/config.toml`:

```toml
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
```

---

## Step 3 — Apply to a new production project

```bash
# 1. Create a new Supabase project in the dashboard
# 2. Enable the pgvector extension:
#    Dashboard → Database → Extensions → vector → Enable
# 3. Link locally:
supabase link --project-ref <new-project-ref>

# 4. Push all migrations:
supabase db push

# 5. Apply the seed:
supabase db execute --file supabase/seed.sql
```

Alternatively, paste the contents of `seed.sql` into the Supabase SQL editor (Dashboard → SQL Editor).

### auth.users caveat

`profiles` rows reference `auth.users` by UUID. If you are moving to a new project, the auth user must exist before the seed runs. The simplest approach:

1. Sign in once with magic link on the new project — this creates the `auth.users` row and triggers the `handle_new_user` function which inserts a `profiles` row.
2. Delete the `profiles` row that was auto-created (to avoid the ON CONFLICT).
3. Apply the seed — or update the UUID in the seed file to match the new auth user's UUID.

---

## Step 4 — Regenerate AI embeddings

After seeding, `embeddings` and `knowledge_chunks` are empty. Regenerate by opening each interaction and clicking **Summarize**, or by calling `POST /api/ai/summarize` for each interaction ID.

---

## FK insertion order (manual SQL editor)

If you apply the seed statement-by-statement without the `session_replication_role` wrapper, insert tables in this order:

1. `profiles`
2. `teams`
3. `roles`
4. `team_members`
5. `role_areas`
6. `team_values`
7. `interactions`
8. `action_items`
9. `agenda_items`
10. `team_member_integrations`
11. `goal_templates`
12. `member_goals`
13. `org_context`
14. `team_coverage_snapshots`
15. `chat_conversations`
16. `chat_messages`
17. `knowledge_documents`
18. `personal_items`

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Error: not linked` | Project not linked | Run `supabase link --project-ref <ref>` |
| `Error: unauthorized` | Not logged in | Run `supabase login` |
| `violates foreign key constraint` | Applied without `session_replication_role` | Wrap INSERTs in the SET/RESET block, or use the insertion order above |
| `duplicate key value violates unique constraint` on `profiles` | `handle_new_user` trigger already inserted a row | Delete the auto-created profiles row before applying seed, or add `ON CONFLICT DO NOTHING` |
| Embeddings missing after reset | Excluded from dump intentionally | Re-run AI summarize on each interaction |
