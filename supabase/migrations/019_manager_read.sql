ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS manager_read text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS manager_read_updated_at timestamptz;
