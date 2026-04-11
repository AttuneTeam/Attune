#!/usr/bin/env bash
set -euo pipefail

# TeamLeader: dump live data as seed SQL
#
# Usage:
#   ./scripts/db-dump.sh [output-path]
#
# Default output: supabase/seed.sql
#
# Requires:
#   supabase login            (once)
#   supabase link --project-ref <ref>   (once per machine)
#
# DO NOT commit the output — it may contain PII.

OUTPUT="${1:-supabase/seed.sql}"

# Exclude large vector tables — regenerate via AI summarize after seeding
EXCLUDE_ARGS=(
  "--exclude-table" "public.embeddings"
  "--exclude-table" "public.knowledge_chunks"
)

echo "→ Dumping data from linked Supabase project..."
echo "  Output : $OUTPUT"
echo "  Skipping: public.embeddings, public.knowledge_chunks"
echo ""

supabase db dump \
  --data-only \
  --linked \
  --schema public \
  "${EXCLUDE_ARGS[@]}" \
  --file "$OUTPUT"

# Wrap in session_replication_role=replica so FK constraints and triggers
# are suspended during bulk insert (needed for self-referential teams.parent_id)
HEADER="-- TeamLeader seed data — generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
-- WARNING: may contain PII. Do not commit this file.
--
SET session_replication_role = 'replica';
"

FOOTER="
RESET session_replication_role;
"

TMPFILE=$(mktemp)
printf '%s\n' "$HEADER" > "$TMPFILE"
cat "$OUTPUT" >> "$TMPFILE"
printf '%s\n' "$FOOTER" >> "$TMPFILE"
mv "$TMPFILE" "$OUTPUT"

echo "✓ Seed written to $OUTPUT"
echo ""
echo "  Local reset : npm run db:reset"
echo "  Remote apply: supabase db execute --file $OUTPUT"
