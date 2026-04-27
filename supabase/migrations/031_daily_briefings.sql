create table daily_briefings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  date          date not null,
  content       jsonb not null,
  generated_at  timestamptz default now(),
  unique(user_id, date)
);

alter table daily_briefings enable row level security;

create policy "Users manage own briefings"
  on daily_briefings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
