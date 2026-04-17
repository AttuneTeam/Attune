-- Store the latest team pulse AI analysis per manager
CREATE TABLE IF NOT EXISTS team_pulse_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE team_pulse_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_pulse" ON team_pulse_snapshots
  FOR ALL USING (manager_id = auth.uid());
