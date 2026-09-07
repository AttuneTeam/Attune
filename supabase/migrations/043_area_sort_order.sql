-- Manual ordering for Surface Area Map areas (spec.md FR9).
--
-- Before this, areas rendered in creation order. A second brain has to be
-- arrangeable: the order a manager puts their territory in carries meaning that
-- created_at cannot express.
--
-- Ordering is per sibling group -- same manager, same parent, and for roots the
-- same domain -- so moving something in one domain never disturbs another.

ALTER TABLE strategic_initiatives
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Backfill preserving exactly what is on screen today, so nobody's map
-- rearranges itself on deploy.
WITH ordered AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY manager_id,
                        kind,
                        COALESCE(parent_id::text, 'root'),
                        CASE WHEN parent_id IS NULL THEN COALESCE(domain, '') ELSE '' END
           ORDER BY created_at
         ) AS position
  FROM strategic_initiatives
)
UPDATE strategic_initiatives si
SET    sort_order = ordered.position
FROM   ordered
WHERE  ordered.id = si.id;

CREATE INDEX initiatives_sibling_order_idx
  ON strategic_initiatives (manager_id, parent_id, sort_order);

-- A shared DEFAULT would put every new area at the same position, leaving the
-- order to whatever the tiebreak happened to be -- the exact arbitrariness
-- manual ordering exists to remove. 0 is the sentinel for "not set": the
-- backfill starts at 1, so it is never a legitimate assigned position.
CREATE OR REPLACE FUNCTION set_initiative_sort_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sort_order IS NULL OR NEW.sort_order = 0 THEN
    SELECT COALESCE(MAX(s.sort_order), 0) + 1
    INTO   NEW.sort_order
    FROM   strategic_initiatives s
    WHERE  s.manager_id = NEW.manager_id
      AND  s.kind = NEW.kind
      AND  s.parent_id IS NOT DISTINCT FROM NEW.parent_id
      AND  (NEW.parent_id IS NOT NULL OR s.domain IS NOT DISTINCT FROM NEW.domain);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER initiative_sort_order
BEFORE INSERT ON strategic_initiatives
FOR EACH ROW
EXECUTE FUNCTION set_initiative_sort_order();

-- Swaps an area with its neighbour.
--
-- Deliberately SECURITY INVOKER: the lookup and both writes run as the caller,
-- so Row-Level Security is what stops one manager reordering another's areas.
-- An elevated function would have to re-implement that check by hand, and a
-- mistake there is a tenancy bug.
--
-- Both writes happen inside one function call, hence one transaction, so two
-- rows cannot be observed sharing a position. That transient duplicate is also
-- why there is no unique index on (group, sort_order) -- it would reject the
-- swap midway.
CREATE OR REPLACE FUNCTION move_area(p_area_id uuid, p_direction text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  me strategic_initiatives;
  neighbour strategic_initiatives;
BEGIN
  IF p_direction NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Direction must be up or down'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO me
  FROM   strategic_initiatives
  WHERE  id = p_area_id AND kind = 'area';

  -- Invisible under RLS is indistinguishable from absent, which is the point.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Area not found'
      USING ERRCODE = '42501';
  END IF;

  IF p_direction = 'up' THEN
    SELECT * INTO neighbour
    FROM   strategic_initiatives s
    WHERE  s.manager_id = me.manager_id
      AND  s.kind = 'area'
      AND  s.parent_id IS NOT DISTINCT FROM me.parent_id
      AND  (me.parent_id IS NOT NULL OR s.domain IS NOT DISTINCT FROM me.domain)
      AND  (s.sort_order, s.created_at) < (me.sort_order, me.created_at)
    ORDER BY s.sort_order DESC, s.created_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO neighbour
    FROM   strategic_initiatives s
    WHERE  s.manager_id = me.manager_id
      AND  s.kind = 'area'
      AND  s.parent_id IS NOT DISTINCT FROM me.parent_id
      AND  (me.parent_id IS NOT NULL OR s.domain IS NOT DISTINCT FROM me.domain)
      AND  (s.sort_order, s.created_at) > (me.sort_order, me.created_at)
    ORDER BY s.sort_order ASC, s.created_at ASC
    LIMIT 1;
  END IF;

  -- Already at the end of its group. A no-op, not an error: the interface
  -- disables the control, but the database must be safe when asked anyway.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE strategic_initiatives SET sort_order = neighbour.sort_order WHERE id = me.id;
  UPDATE strategic_initiatives SET sort_order = me.sort_order WHERE id = neighbour.id;
END;
$$;

GRANT EXECUTE ON FUNCTION move_area(uuid, text) TO authenticated, service_role;
