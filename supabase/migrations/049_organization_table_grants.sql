-- Migration 046 created these tables without table privileges, so on projects
-- where new tables are not granted to the API roles by default, reads fail with
-- "permission denied" before RLS is evaluated. Writes go through the SECURITY
-- DEFINER RPCs (create/rename/archive), so members only need SELECT; RLS still
-- limits them to their own memberships and organisations.
GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_memberships TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.organization_memberships TO service_role;

NOTIFY pgrst, 'reload schema';
