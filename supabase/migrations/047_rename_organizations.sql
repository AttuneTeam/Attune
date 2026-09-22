CREATE OR REPLACE FUNCTION rename_organization(p_organization_id uuid, p_name text)
RETURNS organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE renamed organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Organisation name cannot be empty' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM organization_memberships om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only an organisation owner can rename it' USING ERRCODE = '42501';
  END IF;

  UPDATE organizations
  SET name = trim(p_name)
  WHERE id = p_organization_id
  RETURNING * INTO renamed;

  RETURN renamed;
END;
$$;

REVOKE ALL ON FUNCTION rename_organization(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rename_organization(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
