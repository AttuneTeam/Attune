CREATE TABLE IF NOT EXISTS manager_profile_snapshots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period       text NOT NULL DEFAULT 'quarterly',
  result       jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE manager_profile_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_manager_profile" ON manager_profile_snapshots
  FOR ALL USING (manager_id = auth.uid());
