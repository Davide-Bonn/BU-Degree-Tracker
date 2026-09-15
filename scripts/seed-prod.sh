#!/usr/bin/env bash
# Seed programs to production Supabase (without running the full scrape).
# The production DATABASE_URL is already in the local .env file.
# Run from repo root: bash scripts/seed-prod.sh

set -eo pipefail

echo "Seeding programs to production..."
npx tsx scripts/seed-programs.ts
echo "Done."
