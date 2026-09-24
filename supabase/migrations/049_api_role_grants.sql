-- Grant table-level privileges on every public table to the API roles.
--
-- 039 fixed "permission denied for table" for the persona tables; 044 then hit
-- the same thing for map_domains. The hosted project's default privileges do
-- not grant new tables to anon/authenticated/service_role (the local stack
-- does, which is why it only shows up after deploy), so every table created
-- since has been reachable locally and denied in production.
--
-- RLS is enabled on every public table and is still what scopes each row to its
-- tenant; these grants only let the API roles reach the tables at all.
--
-- Idempotent: re-granting a privilege that is already held is a no-op.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Safety net for tables created by later migrations. Every new table should
-- still carry its own explicit GRANT (lib/supabase/migrations.test.ts enforces
-- that), because default privileges are per creating role and are the very
-- thing that silently failed here.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
