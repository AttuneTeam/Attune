-- Store the latest team coverage analysis per manager
CREATE TABLE IF NOT EXISTS team_coverage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE team_coverage_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_coverage" ON team_coverage_snapshots
  FOR ALL USING (manager_id = auth.uid());
