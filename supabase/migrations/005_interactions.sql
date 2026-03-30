-- Rename meetings table to interactions
ALTER TABLE meetings RENAME TO interactions;

-- Drop old trigger and recreate for renamed table
DROP TRIGGER IF EXISTS meetings_updated_at ON interactions;
CREATE TRIGGER interactions_updated_at
  BEFORE UPDATE ON interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Rename meeting_id columns
ALTER TABLE action_items RENAME COLUMN meeting_id TO interaction_id;
ALTER TABLE embeddings RENAME COLUMN meeting_id TO interaction_id;

-- Add interaction type column
-- 'scheduled' | 'incidental' | 'note' | 'slack'
ALTER TABLE interactions ADD COLUMN type text NOT NULL DEFAULT 'scheduled';

-- Update RLS policies on interactions
DROP POLICY IF EXISTS "own_meetings" ON interactions;
CREATE POLICY "own_interactions" ON interactions
  FOR ALL USING (manager_id = auth.uid());

-- Update RLS policies on action_items (references renamed column)
DROP POLICY IF EXISTS "action_items_via_meeting" ON action_items;
CREATE POLICY "action_items_via_interaction" ON action_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM interactions i
      WHERE i.id = action_items.interaction_id
        AND i.manager_id = auth.uid()
    )
  );

-- Update RLS policies on embeddings
DROP POLICY IF EXISTS "embeddings_via_meeting" ON embeddings;
CREATE POLICY "embeddings_via_interaction" ON embeddings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM interactions i
      WHERE i.id = embeddings.interaction_id
        AND i.manager_id = auth.uid()
    )
  );

-- Drop and recreate match_documents (return type changed: meeting_id → interaction_id)
DROP FUNCTION IF EXISTS match_documents(vector, float, int);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  interaction_id uuid,
  content text,
  similarity float,
  participant_name text,
  scheduled_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    e.id,
    e.interaction_id,
    e.content,
    1 - (e.content_vector <=> query_embedding) AS similarity,
    tm.name AS participant_name,
    i.scheduled_at
  FROM embeddings e
  JOIN interactions i ON i.id = e.interaction_id
  JOIN team_members tm ON tm.id = i.participant_id
  WHERE i.manager_id = auth.uid()
    AND 1 - (e.content_vector <=> query_embedding) > match_threshold
  ORDER BY e.content_vector <=> query_embedding
  LIMIT match_count;
$$;
