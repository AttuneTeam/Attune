-- Chat conversations (one per session)
CREATE TABLE chat_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_conversations" ON chat_conversations
  FOR ALL USING (manager_id = auth.uid());

CREATE TRIGGER chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Chat messages (append-only log per conversation)
CREATE TABLE chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content         text,
  tool_calls      jsonb,
  tool_results    jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS gated through the conversation's manager_id — same pattern as action_items → interactions
CREATE POLICY "own_chat_messages" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.manager_id = auth.uid()
    )
  );
