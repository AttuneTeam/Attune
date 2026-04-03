-- Drop per-member role areas table (replaced by role-level areas)
DROP TABLE IF EXISTS member_role_areas;

-- Generic role definitions library (per manager)
CREATE TABLE roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES profiles(id),
  title      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_owns_roles" ON roles
  FOR ALL USING (manager_id = auth.uid());

-- Areas within each role (the shared description blocks)
CREATE TABLE role_areas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  title         text NOT NULL DEFAULT '',
  description   jsonb,    -- Tiptap JSON
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE role_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_owns_role_areas" ON role_areas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.id = role_areas.role_id
        AND roles.manager_id = auth.uid()
    )
  );

-- Assign a role to a team member (nullable)
ALTER TABLE team_members ADD COLUMN role_id uuid REFERENCES roles(id) ON DELETE SET NULL;
