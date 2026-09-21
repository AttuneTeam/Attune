-- Surface Area Map: adds a second axis to strategic_initiatives.
--
-- The tree already carries structure (parent_id, depth, domain) and receives
-- signals from interactions (migration 040). What it lacks is a way to record
-- how well the manager actually understands each part of their territory, and
-- when they last looked at it. `kind` separates the map's areas from strategic
-- initiatives so both can share one tree, one policy, and one set of signals.
--
-- Every column is defaulted or nullable, so this is safe under the deployment
-- order in workflow.md: migrations run before the application deploys, and for
-- that window the new schema serves the old code. Old code writes none of these
-- columns, and a row it writes must keep behaving exactly as an initiative --
-- hence kind DEFAULT 'initiative' rather than 'area'.

ALTER TABLE strategic_initiatives
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'initiative'
    CONSTRAINT initiatives_kind_check
    CHECK (kind IN ('area', 'initiative')),

  -- Not progress on a task: how well the manager holds this area.
  ADD COLUMN confidence TEXT NOT NULL DEFAULT 'unknown'
    CONSTRAINT initiatives_confidence_check
    CHECK (confidence IN ('unknown', 'aware', 'understood', 'owned')),

  -- NULL means never reviewed. Deliberately not defaulted to now(): a newly
  -- captured area has not been reviewed, and pretending otherwise would hide it
  -- from the staleness signal for the first three weeks of its life.
  ADD COLUMN last_reviewed_at TIMESTAMPTZ,

  -- SET NULL, not CASCADE: removing a team member must never delete the
  -- manager's record of the area that person happened to own.
  ADD COLUMN owner_id UUID REFERENCES team_members(id) ON DELETE SET NULL;

-- The map's only list query is "my areas", and /initiatives becomes
-- "my initiatives". Both are covered by this.
CREATE INDEX initiatives_manager_kind_idx
  ON strategic_initiatives (manager_id, kind);

-- owner_id is the same cross-tenant reference shape that migration 041 closed
-- for parent_id: the row is legitimately the caller's, so RLS sees nothing
-- wrong, yet it points at a team_members row the caller cannot read. Left open,
-- the map would render an owner the manager has no way to identify, and the
-- accepted reference would confirm that a member with that id exists.
CREATE OR REPLACE FUNCTION enforce_initiative_owner_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Elevated for the same reason as the parent check: the referenced row must be
-- looked up even when it is invisible to the caller. search_path is pinned.
SET search_path = public, pg_temp
AS $$
DECLARE
  owner_manager uuid;
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT manager_id INTO owner_manager
  FROM   team_members
  WHERE  id = NEW.owner_id;

  IF owner_manager IS NULL THEN
    RAISE EXCEPTION 'Owner is not a known team member'
      USING ERRCODE = '42501';
  END IF;

  IF owner_manager <> NEW.manager_id THEN
    RAISE EXCEPTION 'Owner belongs to another manager'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER initiative_owner_ownership
BEFORE INSERT OR UPDATE OF owner_id, manager_id ON strategic_initiatives
FOR EACH ROW
EXECUTE FUNCTION enforce_initiative_owner_ownership();
