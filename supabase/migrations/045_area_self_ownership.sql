-- The manager can own an area themselves (spec.md FR8).
--
-- Many areas on a personal map are nobody else's. Without this, "unowned" has
-- to mean both "mine" and "nobody's" -- and the owner column exists precisely
-- to separate them, so the manager can see what is still sitting with them that
-- ought to be delegated.
--
-- Deliberately a flag rather than a team_members row representing the manager.
-- A self row would surface them in the team list, in 1-on-1 coverage and in
-- team pulse, each of which would then need teaching to exclude them -- several
-- places to get wrong, and every one of them a place where the manager appears
-- as one of their own reports.

ALTER TABLE strategic_initiatives
  ADD COLUMN owned_by_manager BOOLEAN NOT NULL DEFAULT false;

-- An area has one owner or none. Allowing both would leave the interface to
-- decide which to believe, and the two answers mean opposite things for
-- delegation. Existing rows all default to false, so this validates cleanly.
ALTER TABLE strategic_initiatives
  ADD CONSTRAINT initiatives_single_owner
  CHECK (NOT (owner_id IS NOT NULL AND owned_by_manager));
