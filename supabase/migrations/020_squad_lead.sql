ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS is_squad_lead boolean NOT NULL DEFAULT false;
