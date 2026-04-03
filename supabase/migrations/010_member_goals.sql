-- Reusable goal title templates (per manager)
CREATE TABLE goal_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES profiles(id),
  title      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (manager_id, title)
);

ALTER TABLE goal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_owns_templates" ON goal_templates
  FOR ALL USING (manager_id = auth.uid());

-- Goals per team member
CREATE TABLE member_goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  manager_id  uuid NOT NULL REFERENCES profiles(id),
  period_type text NOT NULL DEFAULT 'yearly',   -- 'yearly' | 'quarterly' | 'monthly'
  year        integer NOT NULL,
  period      integer,  -- NULL for yearly; 1–4 for quarterly; 1–12 for monthly
  title       text NOT NULL,
  description jsonb,    -- Tiptap JSON
  status      text NOT NULL DEFAULT 'not_started',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE member_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_owns_goals" ON member_goals
  FOR ALL USING (manager_id = auth.uid());
