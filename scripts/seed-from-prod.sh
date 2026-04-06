#!/bin/bash
# Seed local dev database from production Supabase data.
# Prerequisites: npx supabase login + supabase link already done in this project.
# Usage: ./scripts/seed-from-prod.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

DOCKER_CONTAINER="splint-postgres"
DB_NAME="splint_dev"
DB_USER="postgres"

SCHEMA_FILE="prod_schema_dump.sql"
DATA_FILE="prod_data_dump.sql"
DATA_FILE_CLEAN="prod_data_dump_clean.sql"

echo "=== Step 1: Dumping production schema (public schema only) ==="
npx supabase db dump --linked --schema public -f "$SCHEMA_FILE"
echo "Schema dump: $(wc -l < "$SCHEMA_FILE") lines"

echo ""
echo "=== Step 2: Dumping production data (public schema only) ==="
npx supabase db dump --linked --data-only --schema public -f "$DATA_FILE"
echo "Data dump: $(wc -l < "$DATA_FILE") lines"

echo ""
echo "=== Step 3: Cleaning dump for Postgres 16 compatibility ==="
sed '/transaction_timeout/d' "$DATA_FILE" > "$DATA_FILE_CLEAN"

echo ""
echo "=== Step 4: Recreating local database ==="
docker exec "$DOCKER_CONTAINER" psql -U "$DB_USER" -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
  > /dev/null 2>&1 || true
docker exec "$DOCKER_CONTAINER" dropdb -U "$DB_USER" "$DB_NAME" --if-exists
docker exec "$DOCKER_CONTAINER" createdb -U "$DB_USER" "$DB_NAME"
echo "Database $DB_NAME recreated"

echo ""
echo "=== Step 5: Loading schema ==="
docker exec -i "$DOCKER_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$SCHEMA_FILE" 2>&1 \
  | grep -v "role .* does not exist" \
  | grep -v "ALTER DEFAULT PRIVILEGES" \
  | grep -c "ERROR" \
  | xargs -I{} echo "Non-role errors: {}" || true
echo "Schema loaded"

echo ""
echo "=== Step 6: Loading data ==="
docker exec -i "$DOCKER_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -f - < "$DATA_FILE_CLEAN" 2>&1 \
  | grep -c "ERROR" \
  | xargs -I{} echo "Errors (0 expected): {}" || true
echo "Data loaded"

echo ""
echo "=== Step 7: Applying pending Prisma migrations ==="
npx prisma migrate deploy

echo ""
echo "=== Step 8: Generating Prisma client ==="
npx prisma generate

echo ""
echo "=== Row counts ==="
docker exec "$DOCKER_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT 'User' as tbl, count(*) FROM \"User\"
   UNION ALL SELECT 'Organization', count(*) FROM \"Organization\"
   UNION ALL SELECT 'NamedGeometry', count(*) FROM \"NamedGeometry\"
   UNION ALL SELECT 'GeometryProcessingQueue', count(*) FROM \"GeometryProcessingQueue\"
   UNION ALL SELECT 'PrintQueue', count(*) FROM \"PrintQueue\"
   UNION ALL SELECT 'ClientDevice', count(*) FROM \"ClientDevice\"
   UNION ALL SELECT '_prisma_migrations', count(*) FROM \"_prisma_migrations\"
   ORDER BY tbl;"

echo ""
echo "Done. Local dev DB is seeded from production."
