CREATE TABLE org_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Company
  company_name text,
  website text,
  industry text,
  company_stage text,
  company_headcount text,
  countries text[] DEFAULT '{}',
  -- Team
  team_function text,
  team_size text,
  key_tools text[] DEFAULT '{}',
  -- Ways of Working
  team_methodology text,
  company_planning text,
  decision_framework text,
  team_structure text,
  okr_cadence text,
  -- Culture
  company_mission text,
  management_principles text,
  -- Meta
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id)
);

ALTER TABLE org_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_org_context" ON org_context FOR ALL USING (manager_id = auth.uid());
