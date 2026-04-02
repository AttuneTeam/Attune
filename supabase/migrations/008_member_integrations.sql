CREATE TABLE team_member_integrations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id   uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  manager_id  uuid NOT NULL REFERENCES profiles(id),
  provider    text NOT NULL,   -- 'github' | 'slack' | 'confluence' | 'trello'
  handle      text NOT NULL,   -- username / user ID / email on that platform
  created_at  timestamptz DEFAULT now(),
  UNIQUE (member_id, provider)
);

ALTER TABLE team_member_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers_own_member_integrations" ON team_member_integrations
  FOR ALL USING (manager_id = auth.uid());
