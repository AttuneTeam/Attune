CREATE TYPE signal_type AS ENUM ('advances', 'reinforces', 'threatens');

CREATE TABLE interaction_initiative_signals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  initiative_id  UUID NOT NULL REFERENCES strategic_initiatives(id) ON DELETE CASCADE,
  signal         signal_type NOT NULL,
  note           TEXT,
  manager_id     UUID NOT NULL REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (interaction_id, initiative_id)
);

ALTER TABLE interaction_initiative_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_owns_signals"
  ON interaction_initiative_signals
  FOR ALL USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());
