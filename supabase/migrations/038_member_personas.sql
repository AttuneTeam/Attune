-- Member personas — a living, evidence-anchored model of each team member,
-- folded forward one interaction at a time (see lib/ai/member-persona.ts).
--
-- Two tables, same split as manager_read (current) + manager_profile_snapshots (history):
--   member_personas          — the "current" persona, overwritten in place on each fold
--   member_persona_versions  — append-only history; one row per real change, powers diffs

create table member_personas (
  member_id     uuid primary key references team_members(id) on delete cascade,
  manager_id    uuid not null references profiles(id) on delete cascade,
  version       int not null default 1,
  content       jsonb not null,                 -- PersonaContent (lib/ai/member-persona.ts)
  source_counts jsonb not null default '{}',    -- {interactions: 24, reviews: 2, ...}
  generated_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table member_persona_versions (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references team_members(id) on delete cascade,
  manager_id   uuid not null references profiles(id) on delete cascade,
  version      int not null,
  content      jsonb not null,                  -- full snapshot at this version
  delta        jsonb not null default '{}',     -- what changed vs the previous version
  trigger      text,                            -- 'backfill' | 'fold:<interaction_id>' | 'manual'
  generated_at timestamptz not null default now(),
  unique (member_id, version)
);

alter table member_personas enable row level security;
alter table member_persona_versions enable row level security;

create policy "own_member_personas" on member_personas
  for all using (manager_id = auth.uid());

create policy "own_member_persona_versions" on member_persona_versions
  for all using (manager_id = auth.uid());

create index member_persona_versions_member_idx
  on member_persona_versions (member_id, version desc);
