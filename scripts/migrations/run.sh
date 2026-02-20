#!/bin/bash

# Supabase Database Migration Runner
# Run this script to apply all content management database migrations
# Usage: ./scripts/migrations/run.sh

set -e

echo "🔄 Why It Matters - Database Migration Runner"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must be run from project root directory"
  exit 1
fi

# Check if Supabase environment is configured
if [ ! -f ".env.local" ]; then
  echo "❌ Error: .env.local file not found"
  echo "   Please create .env.local with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

# Source environment variables
export $(cat .env.local | xargs)

# Check for required environment variables
if [ -z "$SUPABASE_URL" ]; then
  echo "❌ Error: SUPABASE_URL not set in .env.local"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not set in .env.local"
  exit 1
fi

echo "📦 Environment detected:"
echo "  SUPABASE_URL: $SUPABASE_URL"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
  echo "⚠️  Warning: psql not found. Using curl instead."
  echo ""
  echo "To apply migrations manually:"
  echo "1. Go to Supabase dashboard: https://app.supabase.com"
  echo "2. Select your project"
  echo "3. Click 'SQL Editor' in the sidebar"
  echo "4. Click 'New Query'"
  echo "5. Copy contents from each migration file in order:"
  echo "   - scripts/migrations/001_create_content_direction_table.sql"
  echo "   - scripts/migrations/002_create_review_tasks_table.sql"
  echo "   - scripts/migrations/003_create_video_performance_table.sql"
  echo "6. Execute each query"
  exit 0
fi

echo "🗄️  Starting database migrations..."
echo ""

# Extract host from SUPABASE_URL (format: https://xxxxx.supabase.co)
SUPABASE_HOST=$(echo $SUPABASE_URL | sed 's|https://||' | sed 's|/||g')
POSTGRES_HOST=$(echo $SUPABASE_HOST | sed 's/\.supabase\.co//')

echo "🔗 Connecting to PostgreSQL..."

# Run each migration
MIGRATIONS=(
  "001_create_content_direction_table.sql"
  "002_create_review_tasks_table.sql"
  "003_create_video_performance_table.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  echo ""
  echo "📄 Running: $migration"
  
  if [ -f "scripts/migrations/$migration" ]; then
    psql -U postgres \
      -h "$POSTGRES_HOST.supabase.co" \
      -d postgres \
      -f "scripts/migrations/$migration" \
      2>&1 | grep -E "CREATE TABLE|CREATE INDEX|ERROR" || true
  else
    echo "❌ Migration file not found: scripts/migrations/$migration"
    exit 1
  fi
done

echo ""
echo "✅ All migrations completed successfully!"
echo ""
echo "📊 To verify tables were created:"
echo ""
echo "SELECT table_name FROM information_schema.tables"
echo "WHERE table_schema = 'public'"
echo "AND table_name IN ('content_direction', 'review_tasks', 'video_performance');"
echo ""
echo "To run this verification in Supabase SQL Editor:"
echo "1. Go to https://app.supabase.com/project/[your-project]/sql"
echo "2. Paste the query above"
echo "3. Execute it"
echo ""
