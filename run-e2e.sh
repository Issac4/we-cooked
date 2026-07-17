#!/bin/bash

# Configuration
E2E_DB_NAME="recipe_e2e_test"
PG_USER="recipe_admin"

echo "🚀 Starting Unmocked E2E Test Suite..."

# 1. Ensure the E2E database exists
echo "🔨 Creating ephemeral test database: $E2E_DB_NAME..."
docker compose exec db psql -U $PG_USER -d postgres -c "DROP DATABASE IF EXISTS $E2E_DB_NAME;"
docker compose exec db psql -U $PG_USER -d postgres -c "CREATE DATABASE $E2E_DB_NAME;"

# 2. Restart backend pointing to the E2E database
echo "🔄 Switching backend to E2E mode..."
docker compose stop backend
DB_NAME=$E2E_DB_NAME docker compose up -d backend

# Wait for backend process to be ready
echo "⏳ Waiting for backend to initialize..."
sleep 5

# 3. Run migrations on the new database
echo "📜 Running migrations on $E2E_DB_NAME..."
docker compose exec backend alembic upgrade head

# 4. Run Playwright Tests (Unmocked with Network Bridge)
echo "🎭 Running Playwright E2E tests..."
docker compose exec frontend npx playwright test "$@"

EXIT_CODE=$?

# 5. Teardown
echo "🧹 Cleaning up..."
docker compose stop backend
docker compose up -d backend # Restarts with default .env DB_NAME
echo "🗑 Dropping test database..."
docker compose exec db psql -U $PG_USER -d postgres -c "DROP DATABASE IF EXISTS $E2E_DB_NAME;"

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ E2E Tests Passed (Real Backend & Database verified)!"
else
  echo "❌ E2E Tests Failed!"
fi

exit $EXIT_CODE
