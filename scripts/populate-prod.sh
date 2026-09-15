#!/usr/bin/env bash
# Populate the production Supabase database from your local machine.
# The production DATABASE_URL is already in the local .env file.
#
# Run from repo root: bash scripts/populate-prod.sh
#
# Order matters:
#   1. db push       — ensure all tables exist in Supabase
#   2. seed-programs — upsert majors / minors / joint majors (~5 s)
#   3. scrape        — BU bulletin → courses, schedules, hub areas, prereqs (~10 min)
#   4. scrape-rmp    — reads instructors from step 3, queries RMP (~20 min)

set -eo pipefail

echo "── 1/4  Applying schema to production DB ──────────────────"
npx prisma db push
echo ""

echo "── 2/4  Seeding programs ───────────────────────────────────"
npx tsx scripts/seed-programs.ts
echo ""

echo "── 3/4  Scraping BU course catalog (may take ~10 min) ──────"
npx tsx scripts/scrape.ts
echo ""

echo "── 4/4  Scraping RateMyProfessors (may take ~20 min) ───────"
npx tsx scripts/scrape-rmp.ts
echo ""

echo "Done. All data is now in production Supabase."
