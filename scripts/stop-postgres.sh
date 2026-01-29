#!/bin/bash
#
# Stop the local PostgreSQL development database
#

set -e

CONTAINER_NAME="splint-postgres"

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "⏸️  Stopping PostgreSQL container..."
  docker stop ${CONTAINER_NAME}
  echo "✅ PostgreSQL stopped"
else
  echo "ℹ️  PostgreSQL is not running"
fi
