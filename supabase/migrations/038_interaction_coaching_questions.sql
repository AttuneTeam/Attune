alter table interactions add column if not exists coaching_questions text[] not null default '{}';
