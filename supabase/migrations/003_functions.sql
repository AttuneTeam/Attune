-- Semantic search function using pgvector cosine similarity
-- RLS is enforced via the JOIN on meetings table
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  meeting_id uuid,
  content text,
  similarity float,
  participant_name text,
  scheduled_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    e.id,
    e.meeting_id,
    e.content,
    1 - (e.content_vector <=> query_embedding) AS similarity,
    tm.name AS participant_name,
    m.scheduled_at
  FROM embeddings e
  JOIN meetings m ON m.id = e.meeting_id
  JOIN team_members tm ON tm.id = m.participant_id
  WHERE m.manager_id = auth.uid()
    AND 1 - (e.content_vector <=> query_embedding) > match_threshold
  ORDER BY e.content_vector <=> query_embedding
  LIMIT match_count;
$$;
