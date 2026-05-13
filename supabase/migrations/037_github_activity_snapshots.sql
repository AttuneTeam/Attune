create table if not exists github_activity_snapshots (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  github_handle text not null,
  week_start date not null,
  pr_review_comment_count int not null default 0,
  created_at timestamptz not null default now(),
  unique(manager_id, github_handle, week_start)
);

alter table github_activity_snapshots enable row level security;

create policy "Users manage own github snapshots"
  on github_activity_snapshots for all
  using (auth.uid() = manager_id)
  with check (auth.uid() = manager_id);
