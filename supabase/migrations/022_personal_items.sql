CREATE TABLE personal_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('note', 'todo', 'link', 'reminder')),
  content     TEXT NOT NULL DEFAULT '',
  url         TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  due_date    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE personal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_items_self" ON personal_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
