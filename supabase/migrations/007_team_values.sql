CREATE TABLE team_values (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  manager_id  uuid NOT NULL REFERENCES profiles(id),
  name        text NOT NULL,
  description text,
  keywords    text[] DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE team_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers_own_team_values" ON team_values
  FOR ALL USING (manager_id = auth.uid());
