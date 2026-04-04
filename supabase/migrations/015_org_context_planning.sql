ALTER TABLE org_context
  RENAME COLUMN planning_methodology TO team_methodology;

ALTER TABLE org_context
  ADD COLUMN company_planning text;
