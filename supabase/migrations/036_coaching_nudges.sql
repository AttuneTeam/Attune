ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS coaching_nudges jsonb,
  ADD COLUMN IF NOT EXISTS coaching_nudges_updated_at timestamptz;
