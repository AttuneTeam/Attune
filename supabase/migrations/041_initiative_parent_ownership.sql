-- Constrain strategic_initiatives.parent_id to rows owned by the same manager.
--
-- parent_id is ON DELETE CASCADE while the RLS policy checks only manager_id, so
-- one manager could parent a row they own into another manager's tree. Nothing
-- leaked -- the attacker still could not read the parent -- but the coupling meant
-- the second manager deleting their own row silently destroyed the first
-- manager's row. One tenant could erase another's data.
--
-- Enforced with a trigger rather than an RLS WITH CHECK: a policy on
-- strategic_initiatives cannot subquery strategic_initiatives without tripping
-- "infinite recursion detected in policy for relation". A trigger also covers
-- service-role writes, which bypass RLS entirely.

-- 1. Repair existing violations by detaching, never deleting. A detached row is
--    recoverable by its owner; a cascaded one is gone.
UPDATE strategic_initiatives AS c
SET    parent_id = NULL,
       depth     = 0
FROM   strategic_initiatives AS p
WHERE  c.parent_id = p.id
  AND  c.manager_id <> p.manager_id;

-- 2. Guard every future write.
CREATE OR REPLACE FUNCTION enforce_initiative_parent_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- SECURITY DEFINER runs as the function owner, which bypasses RLS. That is
-- deliberate: the parent row must be looked up even when it is invisible to the
-- caller. search_path is pinned so the elevated body cannot be redirected.
SET search_path = public, pg_temp
AS $$
DECLARE
  parent_manager uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'An initiative cannot be its own parent'
      USING ERRCODE = '42501';
  END IF;

  SELECT manager_id INTO parent_manager
  FROM   strategic_initiatives
  WHERE  id = NEW.parent_id;

  IF parent_manager IS NULL THEN
    RAISE EXCEPTION 'Parent initiative does not exist'
      USING ERRCODE = '42501';
  END IF;

  IF parent_manager <> NEW.manager_id THEN
    RAISE EXCEPTION 'Parent initiative belongs to another manager'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Fires on INSERT, and on any UPDATE that touches either side of the
-- relationship. 42501 (insufficient_privilege) matches how RLS denials already
-- surface, so callers need no special case for this check.
CREATE TRIGGER initiative_parent_ownership
BEFORE INSERT OR UPDATE OF parent_id, manager_id ON strategic_initiatives
FOR EACH ROW
EXECUTE FUNCTION enforce_initiative_parent_ownership();
