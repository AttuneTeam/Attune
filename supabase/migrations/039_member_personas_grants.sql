-- Grant table-level privileges on the persona tables to the API roles.
-- 038 created the tables but the default-privileges grant did not fire for
-- them, so the authenticated role hit "permission denied for table".
-- RLS still scopes every row to manager_id = auth.uid(); these grants only
-- let the API roles reach the tables at all.
grant all on table member_personas to anon, authenticated, service_role;
grant all on table member_persona_versions to anon, authenticated, service_role;
