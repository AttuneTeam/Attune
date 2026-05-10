#!/usr/bin/env bash
set -euo pipefail

# Syncs production Supabase data and storage files to the local dev instance.
# Usage: ./scripts/sync-from-prod.sh
#
# Requires:
#   - supabase CLI (v2.x with --experimental flag)
#   - Local supabase instance running (`supabase start`)
#   - Project linked to remote (`supabase link`)

LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:54332/postgres"
PSQL="${PSQL_BIN:-/Library/PostgreSQL/15/bin/psql}"
# STORAGE_BUCKETS=("invoices" "property-files" "renovation-quotes")
TMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "==> Checking local Supabase is running..."
if ! "$PSQL" "$LOCAL_DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
  echo "ERROR: Local Supabase is not running. Run: supabase start"
  exit 1
fi

# ── Database ────────────────────────────────────────────────────────────────

echo ""
echo "==> Dumping data from production..."
supabase db dump --linked --data-only -f "$TMP_DIR/prod_data.sql"

echo "==> Clearing existing local data..."
# Clear auth.users (CASCADE drops all dependent auth rows: identities, sessions,
# refresh_tokens, mfa_factors, mfa_amr_claims, one_time_tokens, etc.).
# Then clear public schema tables and storage objects.
"$PSQL" "$LOCAL_DB_URL" --quiet <<'SQL'
-- auth schema: wipe user rows and all tables that cascade from them
TRUNCATE auth.users CASCADE;
-- Some Supabase versions have standalone audit/flow tables with no user FK
DO $$ BEGIN EXECUTE 'TRUNCATE auth.audit_log_entries CASCADE'; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'TRUNCATE auth.flow_state CASCADE';        EXCEPTION WHEN undefined_table THEN NULL; END $$;
-- public schema
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;
TRUNCATE storage.objects CASCADE;
SQL

echo "==> Restoring data into local database..."
# ON_ERROR_STOP=0 lets duplicate storage.buckets rows (pre-seeded by migrations) be skipped.
# Auth and public data are inserted in FK-dependency order by pg_dump, so no trigger
# override is needed provided auth tables were fully cleared above.
"$PSQL" "$LOCAL_DB_URL" \
  --quiet -v ON_ERROR_STOP=0 \
  -f "$TMP_DIR/prod_data.sql" \
  2>&1 | grep -v "duplicate key\|DETAIL:" || true

echo "    Data restored."

# ── Storage ─────────────────────────────────────────────────────────────────

# for BUCKET in "${STORAGE_BUCKETS[@]}"; do
#   echo ""
#   echo "==> Syncing storage bucket: $BUCKET"

#   LOCAL_BUCKET_DIR="$TMP_DIR/storage/$BUCKET"
#   mkdir -p "$LOCAL_BUCKET_DIR"

#   # Download from remote (linked = default)
#   echo "    Downloading from remote..."
#   if supabase storage cp --experimental --recursive "ss:///$BUCKET" "$LOCAL_BUCKET_DIR" 2>/dev/null; then
#     # Ensure the bucket exists locally
#     supabase storage cp --experimental --local --recursive "$LOCAL_BUCKET_DIR" "ss:///$BUCKET" 2>/dev/null || true
#     echo "    Uploaded to local storage."
#   else
#     echo "    WARNING: Could not download bucket '$BUCKET' (may be empty or inaccessible)."
#   fi
# done

echo ""
echo "==> Sync complete."
