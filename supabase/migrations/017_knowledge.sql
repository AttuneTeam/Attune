-- Knowledge documents: reference material uploaded by the manager
CREATE TABLE knowledge_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title          text NOT NULL,
  content        text NOT NULL,
  source         text,           -- optional URL, filename, or description of origin
  content_vector vector(1536),   -- embedding of the full content (for single-chunk docs)
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_knowledge_documents" ON knowledge_documents
  FOR ALL USING (manager_id = auth.uid());

CREATE TRIGGER knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Chunks table for larger documents (mirrors embeddings table pattern)
CREATE TABLE knowledge_chunks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  manager_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content        text NOT NULL,
  content_vector vector(1536),
  chunk_index    int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_knowledge_chunks" ON knowledge_chunks
  FOR ALL USING (manager_id = auth.uid());

-- Semantic search across knowledge chunks
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.65,
  match_count     int DEFAULT 5
)
RETURNS TABLE (
  chunk_id    uuid,
  document_id uuid,
  title       text,
  content     text,
  source      text,
  similarity  float
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    kc.id            AS chunk_id,
    kc.document_id,
    kd.title,
    kc.content,
    kd.source,
    1 - (kc.content_vector <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE kd.manager_id = auth.uid()
    AND 1 - (kc.content_vector <=> query_embedding) > match_threshold
  ORDER BY kc.content_vector <=> query_embedding
  LIMIT match_count;
$$;
