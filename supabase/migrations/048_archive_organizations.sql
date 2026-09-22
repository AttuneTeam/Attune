ALTER TABLE public.organizations
  ADD COLUMN archived_at timestamptz;

-- Archived organisations remain visible to their members for management, but
-- cannot be selected as the active data scope.
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT om.organization_id
      FROM public.organization_memberships om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-organization-id')
        AND o.archived_at IS NULL
      LIMIT 1
    ),
    (
      SELECT om.organization_id
      FROM public.organization_memberships om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND o.archived_at IS NULL
      ORDER BY om.created_at
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION set_organization_archived(
  p_organization_id uuid,
  p_archived boolean
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_archived IS NULL THEN
    RAISE EXCEPTION 'Archive state is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only an organisation owner can archive or restore it' USING ERRCODE = '42501';
  END IF;

  IF p_archived AND NOT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.organization_id <> p_organization_id
      AND o.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Keep at least one active organisation' USING ERRCODE = '22023';
  END IF;

  UPDATE public.organizations
  SET archived_at = CASE
    WHEN p_archived THEN COALESCE(archived_at, now())
    ELSE NULL
  END
  WHERE id = p_organization_id
  RETURNING * INTO updated;

  RETURN updated;
END;
$$;

REVOKE ALL ON FUNCTION public.set_organization_archived(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_organization_archived(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
