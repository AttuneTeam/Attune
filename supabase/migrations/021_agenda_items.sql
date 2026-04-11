CREATE TABLE agenda_items (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  interaction_id UUID        NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  text           TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open', 'discussed')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers can crud own agenda items" ON agenda_items
  USING (
    EXISTS (
      SELECT 1 FROM interactions
      WHERE interactions.id = agenda_items.interaction_id
        AND interactions.manager_id = auth.uid()
    )
  );
