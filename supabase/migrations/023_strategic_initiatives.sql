CREATE TABLE strategic_initiatives (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL DEFAULT 'Untitled Strategy',
  description    JSONB,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  tags           TEXT[] NOT NULL DEFAULT '{}',
  domain         TEXT,
  horizon        TEXT,
  source_chat_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE strategic_initiatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers_own_initiatives" ON strategic_initiatives
  FOR ALL USING (manager_id = auth.uid());
