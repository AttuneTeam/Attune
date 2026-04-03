-- Structured role areas per team member (replaces single role_description text for detail view)
CREATE TABLE member_role_areas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  manager_id    uuid NOT NULL REFERENCES profiles(id),
  title         text NOT NULL DEFAULT '',
  description   jsonb,    -- Tiptap JSON
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE member_role_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_owns_role_areas" ON member_role_areas
  FOR ALL USING (manager_id = auth.uid());
