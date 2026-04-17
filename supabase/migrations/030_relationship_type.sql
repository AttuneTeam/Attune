ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS relationship text NOT NULL DEFAULT 'direct_report';

ALTER TABLE team_members
  ADD CONSTRAINT team_members_relationship_check
  CHECK (relationship IN ('direct_report', 'stakeholder'));
