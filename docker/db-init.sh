#!/bin/bash
# Database initializer — runs once on first deploy (and harmlessly on redeploys).
# Runs inside the BACKEND image, which has psql, python and the app code.
#   1. Waits for PostgreSQL.
#   2. Applies the COMPLETE schema (all enum types + tables) if not already present.
#   3. Seeds the global admin user so the system is immediately loginable.
set -e

HOST="${DATABASE_HOST:-postgres}"
PORT="${DATABASE_PORT:-5432}"

echo "Waiting for PostgreSQL at ${HOST}:${PORT}..."
until pg_isready -h "$HOST" -p "$PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -q; do
  sleep 2
done
echo "PostgreSQL is ready."

export PGPASSWORD="$DATABASE_PASSWORD"
PSQL="psql -h $HOST -p $PORT -U $DATABASE_USER -d $DATABASE_NAME"

# ── 1. Schema ────────────────────────────────────────────────────────────────
# The complete schema (48 enum types + every table, index, FK, sequence) is a
# pg_dump --schema-only of the validated system. pg_dump output is not idempotent,
# so apply it only when the database is still empty (auth_user absent).
if [ "$($PSQL -tAc "SELECT to_regclass('public.auth_user')" 2>/dev/null | tr -d '[:space:]')" = "auth_user" ]; then
  echo "Schema already present — skipping schema load."
else
  echo "Applying complete schema..."
  $PSQL -v ON_ERROR_STOP=1 -f /migrations/complete_schema.sql
  echo "  ✓ Complete schema applied"
fi

# ── 1b. Incremental migrations (idempotent — runs on fresh AND existing DBs) ──
# Additive changes made after the pg_dump. Safe to run every deploy (no-op when
# already applied). This keeps an EXISTING prod DB up to date with no code change.
# Optional file, so an older bundle without it still boots.
if [ -f /migrations/incremental.sql ]; then
  echo "Applying incremental migrations..."
  $PSQL -v ON_ERROR_STOP=1 -f /migrations/incremental.sql
  echo "  ✓ Incremental migrations applied"
fi

# ── 2. Seed initial data (idempotent — creates global admin only if missing) ──
echo "Seeding initial data..."
cd /app && python /app/seed_initial.py

echo "Database initialization complete."
