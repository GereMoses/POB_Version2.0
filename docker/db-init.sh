#!/bin/bash
# Database initializer — runs once on first deploy.
# Waits for PostgreSQL to be ready, then applies schema migrations.
# Safe to run on a database that already has the schema (all statements are idempotent).

set -e

echo "Waiting for PostgreSQL..."
until pg_isready -h "$DATABASE_HOST" -p "${DATABASE_PORT:-5432}" -U "$DATABASE_USER" -d "$DATABASE_NAME" -q; do
  sleep 2
done
echo "PostgreSQL is ready."

PSQL="psql postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT:-5432}/${DATABASE_NAME}"

echo "Applying database schema..."

# Apply the complete base schema (idempotent — uses CREATE IF NOT EXISTS / DO blocks)
$PSQL -f /migrations/complete_database_setup.sql && echo "  ✓ Base schema applied"

# Apply zone fixes (idempotent)
$PSQL -f /migrations/fix_zones_final.sql && echo "  ✓ Zone schema applied"

echo "Database initialization complete."
