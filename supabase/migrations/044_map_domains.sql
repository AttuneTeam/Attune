-- Domains become rows (spec.md FR10).
--
-- A domain was a text string repeated on every area in it. Renaming one meant
-- rewriting every row, and there was nowhere at all to record an order. The
-- manager asked for a create dialog, renaming, and reordering; all three are
-- the same missing entity.
--
-- The `domain` text column is deliberately kept and left in place. workflow.md
-- forbids dropping a column in the release that stops using it, because
-- migrations run before the application deploys -- for that window the old code
-- is still reading `domain`. It is removed in a later release.

CREATE TABLE map_domains (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CONSTRAINT map_domains_name_not_blank
              CHECK (length(trim(name)) > 0),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Per manager, not global: a global constraint would leak the existence of
  -- another tenant's domain through a failed insert.
  CONSTRAINT map_domains_unique_per_manager UNIQUE (manager_id, name)
);

ALTER TABLE map_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers_own_domains" ON map_domains
  FOR ALL USING (manager_id = auth.uid());

CREATE INDEX map_domains_manager_order_idx ON map_domains (manager_id, sort_order);

-- Same sentinel as areas (043): 0 means "not set", and positions start at 1.
CREATE OR REPLACE FUNCTION set_map_domain_sort_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sort_order IS NULL OR NEW.sort_order = 0 THEN
    SELECT COALESCE(MAX(d.sort_order), 0) + 1
    INTO   NEW.sort_order
    FROM   map_domains d
    WHERE  d.manager_id = NEW.manager_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER map_domain_sort_order
BEFORE INSERT ON map_domains
FOR EACH ROW
EXECUTE FUNCTION set_map_domain_sort_order();

-- SET NULL, never CASCADE. Deleting a domain removes a heading; it must not
-- destroy the territory filed underneath it.
ALTER TABLE strategic_initiatives
  ADD COLUMN domain_id UUID REFERENCES map_domains(id) ON DELETE SET NULL;

CREATE INDEX initiatives_domain_idx ON strategic_initiatives (domain_id);

-- Backfill. sort_order is assigned alphabetically, which is exactly the order
-- the map renders today, so nobody's groups move on deploy.
INSERT INTO map_domains (manager_id, name, sort_order)
SELECT d.manager_id,
       d.domain,
       row_number() OVER (PARTITION BY d.manager_id ORDER BY d.domain)
FROM (
  SELECT DISTINCT manager_id, domain
  FROM   strategic_initiatives
  WHERE  kind = 'area'
    AND  domain IS NOT NULL
    AND  trim(domain) <> ''
) AS d;

UPDATE strategic_initiatives si
SET    domain_id = md.id
FROM   map_domains md
WHERE  md.manager_id = si.manager_id
  AND  md.name = si.domain
  AND  si.kind = 'area';

-- The same cross-tenant reference guard as parent_id (041) and owner_id (042):
-- the row is legitimately the caller's, so RLS sees nothing wrong, yet it would
-- point at a domain they cannot read.
CREATE OR REPLACE FUNCTION enforce_initiative_domain_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  domain_manager uuid;
BEGIN
  IF NEW.domain_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT manager_id INTO domain_manager
  FROM   map_domains
  WHERE  id = NEW.domain_id;

  IF domain_manager IS NULL THEN
    RAISE EXCEPTION 'Domain does not exist'
      USING ERRCODE = '42501';
  END IF;

  IF domain_manager <> NEW.manager_id THEN
    RAISE EXCEPTION 'Domain belongs to another manager'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER initiative_domain_ownership
BEFORE INSERT OR UPDATE OF domain_id, manager_id ON strategic_initiatives
FOR EACH ROW
EXECUTE FUNCTION enforce_initiative_domain_ownership();

-- Reordering domains, mirroring move_area (043). SECURITY INVOKER, so RLS is
-- what stops one manager reordering another's domains.
CREATE OR REPLACE FUNCTION move_domain(p_domain_id uuid, p_direction text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  me map_domains;
  neighbour map_domains;
BEGIN
  IF p_direction NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Direction must be up or down' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO me FROM map_domains WHERE id = p_domain_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Domain not found' USING ERRCODE = '42501';
  END IF;

  IF p_direction = 'up' THEN
    SELECT * INTO neighbour FROM map_domains d
    WHERE  d.manager_id = me.manager_id
      AND  (d.sort_order, d.created_at) < (me.sort_order, me.created_at)
    ORDER BY d.sort_order DESC, d.created_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO neighbour FROM map_domains d
    WHERE  d.manager_id = me.manager_id
      AND  (d.sort_order, d.created_at) > (me.sort_order, me.created_at)
    ORDER BY d.sort_order ASC, d.created_at ASC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE map_domains SET sort_order = neighbour.sort_order WHERE id = me.id;
  UPDATE map_domains SET sort_order = me.sort_order WHERE id = neighbour.id;
END;
$$;

GRANT EXECUTE ON FUNCTION move_domain(uuid, text) TO authenticated, service_role;
