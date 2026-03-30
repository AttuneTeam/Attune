-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- profiles: users can only read/update their own profile
-- ============================================================
CREATE POLICY "own_profile_select" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "own_profile_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "own_profile_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- teams: managers see only teams they manage
-- ============================================================
CREATE POLICY "own_teams" ON teams
  FOR ALL USING (manager_id = auth.uid());

-- ============================================================
-- team_members: managers see only their own direct reports
-- ============================================================
CREATE POLICY "own_reports" ON team_members
  FOR ALL USING (manager_id = auth.uid());

-- ============================================================
-- meetings: managers see only meetings they ran
-- ============================================================
CREATE POLICY "own_meetings" ON meetings
  FOR ALL USING (manager_id = auth.uid());

-- ============================================================
-- action_items: access via meeting ownership
-- ============================================================
CREATE POLICY "action_items_via_meeting" ON action_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = action_items.meeting_id
        AND m.manager_id = auth.uid()
    )
  );

-- ============================================================
-- embeddings: access via meeting ownership
-- ============================================================
CREATE POLICY "embeddings_via_meeting" ON embeddings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = embeddings.meeting_id
        AND m.manager_id = auth.uid()
    )
  );
