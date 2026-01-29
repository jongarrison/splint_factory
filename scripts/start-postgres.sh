#!/bin/bash
#
# Start the local PostgreSQL development database
#

set -e

CONTAINER_NAME="splint-postgres"

# Check if container exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  # Container exists, check if it's running
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "✅ PostgreSQL is already running"
    echo "   Connection: postgresql://postgres:dev_password@localhost:5432/splint_dev"
  else
    echo "▶️  Starting existing PostgreSQL container..."
    docker start ${CONTAINER_NAME}
    sleep 2
    echo "✅ PostgreSQL started"
    echo "   Connection: postgresql://postgres:dev_password@localhost:5432/splint_dev"
  fi
else
  # Container doesn't exist, create it
  echo "🚀 Creating new PostgreSQL container..."
  docker run --name ${CONTAINER_NAME} \
    -e POSTGRES_PASSWORD=dev_password \
    -e POSTGRES_DB=splint_dev \
    -p 5432:5432 \
    -v splint-postgres-data:/var/lib/postgresql/data \
    -d postgres:16
  
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 3
  
  echo "✅ PostgreSQL created and started"
  echo "   Connection: postgresql://postgres:dev_password@localhost:5432/splint_dev"
fi
