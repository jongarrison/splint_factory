#!/bin/bash
#
# Check the status of the local PostgreSQL development database
#

CONTAINER_NAME="splint-postgres"

echo "🔍 PostgreSQL Status:"
echo ""

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "  Status: ✅ Running"
    echo "  Container: ${CONTAINER_NAME}"
    echo "  Connection: postgresql://postgres:dev_password@localhost:5432/splint_dev"
    echo ""
    echo "  To connect:"
    echo "    docker exec -it ${CONTAINER_NAME} psql -U postgres -d splint_dev"
  else
    echo "  Status: ⏸️  Stopped"
    echo "  Container: ${CONTAINER_NAME} (exists but not running)"
    echo ""
    echo "  To start:"
    echo "    npm run db:start"
  fi
else
  echo "  Status: ❌ Not created"
  echo ""
  echo "  To create and start:"
  echo "    npm run db:start"
fi
