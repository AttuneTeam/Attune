-- Store which AI persona was used to start each conversation
ALTER TABLE chat_conversations
  ADD COLUMN persona_id text NOT NULL DEFAULT 'default';
