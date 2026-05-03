create table workshop_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  question         text not null,
  persona_ids      text[] not null,
  persona_analyses jsonb not null,
  synthesis        jsonb not null,
  created_at       timestamptz not null default now()
);

alter table workshop_sessions enable row level security;

create policy "Users own their workshop sessions"
  on workshop_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index workshop_sessions_user_id_created_at_idx
  on workshop_sessions (user_id, created_at desc);
