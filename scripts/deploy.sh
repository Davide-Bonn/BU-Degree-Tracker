#!/usr/bin/env bash
# =============================================================================
# BU Suggestor — Full data pipeline + Vercel deploy
#
# Steps (in order):
#   1. prisma db push       sync schema to Supabase (non-destructive, no data loss)
#   2. npm run refresh      scrape BU Bulletin, tag labs, detect all changes
#   3. deploy to Vercel     only if code files changed (git push or vercel CLI)
#
# Usage:
#   bash scripts/deploy.sh                        full run, all schools
#   bash scripts/deploy.sh --schools cas eng      only CAS + ENG
#   bash scripts/deploy.sh --skip-courses         skip scrape, re-tag + report only
#   bash scripts/deploy.sh --force-deploy         deploy to Vercel even if no changes
#   bash scripts/deploy.sh --no-deploy            skip Vercel step (data pipeline only)
#
# Prerequisites (one of):
#   A) Git remote set up  →  git pushes trigger Vercel auto-deploy
#   B) Vercel CLI         →  npx vercel --prod
# =============================================================================

set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; CYAN='\033[0;36m'; RESET='\033[0m'

step()  { echo -e "\n${CYAN}${BOLD}▶ $*${RESET}"; }
ok()    { echo -e "  ${GREEN}✓${RESET} $*"; }
warn()  { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
err()   { echo -e "  ${RED}✗${RESET} $*"; }
info()  { echo -e "  · $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_FILE="$ROOT/data/refresh-report.json"

# ── Parse args ─────────────────────────────────────────────────────────────────
REFRESH_ARGS=()
FORCE_DEPLOY=false
NO_DEPLOY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force-deploy)   FORCE_DEPLOY=true; shift ;;
    --no-deploy)      NO_DEPLOY=true;    shift ;;
    --schools)
      REFRESH_ARGS+=("--schools")
      shift
      while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
        REFRESH_ARGS+=("$1"); shift
      done
      ;;
    *)  REFRESH_ARGS+=("$1"); shift ;;
  esac
done

# ── Banner ──────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║        BU Suggestor — Data Pipeline + Deploy         ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo -e "  Root:   $ROOT"
echo -e "  Args:   ${REFRESH_ARGS[*]:-"(none — full scrape)"}"
echo -e "  Deploy: $([ "$NO_DEPLOY" = true ] && echo 'skipped (--no-deploy)' || echo 'enabled')"

cd "$ROOT"

# ── Step 1: Schema sync ────────────────────────────────────────────────────────
step "1/3  Schema sync  (prisma db push)"
info "Applying any pending schema changes to Supabase..."
info "Note: stop the Next.js dev server if you see an EPERM error below."

# --skip-generate avoids the DLL-lock EPERM when dev server is running.
# Vercel runs 'prisma generate' itself during its build step.
if npx prisma db push --skip-generate 2>&1; then
  ok "Database schema is in sync."
else
  err "prisma db push failed. Check your DATABASE_URL in .env and try again."
  exit 1
fi

# ── Step 2: Full refresh ───────────────────────────────────────────────────────
step "2/3  Full data refresh  (scrape → lab tag → change report)"
info "Writing report to: $REPORT_FILE"

if npx tsx scripts/refresh.ts "${REFRESH_ARGS[@]}" --report-file "$REPORT_FILE"; then
  ok "Refresh complete."
else
  err "Refresh script failed. See output above."
  exit 1
fi

# ── Determine whether there were meaningful changes ────────────────────────────
HAS_DATA_CHANGES=false
if [[ -f "$REPORT_FILE" ]]; then
  # Use node (always available) to read the JSON summary
  CHANGES_JSON=$(node -e "
    const r = require('$REPORT_FILE');
    const s = r.summary;
    const changed = s.coursesAdded + s.coursesRemoved + s.coursesModified + s.labsTagged;
    console.log(JSON.stringify({ changed, ...s }));
  " 2>/dev/null || echo '{"changed":0}')

  CHANGED_COUNT=$(echo "$CHANGES_JSON" | node -e "process.stdin.on('data',d=>process.stdout.write(JSON.parse(d).changed.toString()))")

  if [[ "$CHANGED_COUNT" -gt 0 ]]; then
    HAS_DATA_CHANGES=true
    ok "Data changes detected: $CHANGED_COUNT item(s) updated in Supabase."
  else
    info "No data changes detected — DB is already up to date."
  fi
fi

# ── Step 3: Deploy to Vercel ──────────────────────────────────────────────────
step "3/3  Vercel deployment"

if [[ "$NO_DEPLOY" = true ]]; then
  info "Skipped (--no-deploy)."
  echo ""
  echo -e "${BOLD}Pipeline complete. DB updated; Vercel deploy skipped.${RESET}"
  exit 0
fi

# Check for code-level git changes (schema, src/, scripts/, etc.)
HAS_CODE_CHANGES=false
IS_GIT_REPO=false
if git -C "$ROOT" rev-parse --is-inside-work-tree &>/dev/null; then
  IS_GIT_REPO=true
  # Count changed tracked files (staged + unstaged, excluding data/ reports)
  CHANGED_FILES=$(git -C "$ROOT" diff --name-only HEAD 2>/dev/null; git -C "$ROOT" diff --cached --name-only 2>/dev/null; git -C "$ROOT" ls-files --others --exclude-standard 2>/dev/null | grep -v '^data/refresh-report' || true)
  if [[ -n "$CHANGED_FILES" ]]; then
    HAS_CODE_CHANGES=true
    info "Changed files:"
    echo "$CHANGED_FILES" | sed 's/^/       /'
  fi
fi

SHOULD_DEPLOY=false
if [[ "$FORCE_DEPLOY" = true ]]; then
  SHOULD_DEPLOY=true
  info "--force-deploy set: deploying regardless of changes."
elif [[ "$HAS_CODE_CHANGES" = true ]]; then
  SHOULD_DEPLOY=true
  ok "Code changes detected → triggering deployment."
elif [[ "$HAS_DATA_CHANGES" = true ]]; then
  SHOULD_DEPLOY=true
  ok "Data changes detected → triggering deployment to apply schema/client updates."
else
  info "No changes detected. Skipping deployment."
fi

if [[ "$SHOULD_DEPLOY" = false ]]; then
  echo ""
  echo -e "${GREEN}${BOLD}All done. Nothing to deploy.${RESET}"
  exit 0
fi

# ── Deploy: prefer git push, fall back to vercel CLI ──────────────────────────
DEPLOYED=false

# Option A: Git push (triggers Vercel's GitHub/GitLab integration)
if [[ "$IS_GIT_REPO" = true ]]; then
  REMOTE=$(git -C "$ROOT" remote get-url origin 2>/dev/null || echo "")
  if [[ -n "$REMOTE" ]]; then
    BRANCH=$(git -C "$ROOT" branch --show-current 2>/dev/null || echo "main")
    info "Git remote: $REMOTE"
    info "Pushing branch: $BRANCH"

    git -C "$ROOT" add \
      prisma/schema.prisma \
      src/ \
      scripts/ \
      data/scrape-log.json \
      data/hub-overrides.json \
      package.json \
      vercel.json \
      .gitignore \
      2>/dev/null || true

    # Only commit if there's something staged
    if ! git -C "$ROOT" diff --cached --quiet 2>/dev/null; then
      TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
      git -C "$ROOT" commit -m "chore: BU data refresh ${TIMESTAMP}

Auto-committed by scripts/deploy.sh
$([ -f "$REPORT_FILE" ] && node -e "
  const r = require('$REPORT_FILE');
  const s = r.summary;
  console.log('Changes: +' + s.coursesAdded + ' courses, ' + s.coursesRemoved + ' removed, ' + s.coursesModified + ' modified, ' + s.labsTagged + ' lab tags');
" 2>/dev/null || true)"
    else
      info "Nothing new to commit (all changes already staged or committed)."
    fi

    git -C "$ROOT" push origin "$BRANCH"
    ok "Pushed to $BRANCH — Vercel will auto-deploy."
    DEPLOYED=true
  fi
fi

# Option B: Vercel CLI
if [[ "$DEPLOYED" = false ]]; then
  if command -v vercel &>/dev/null || npx --yes vercel --version &>/dev/null 2>&1; then
    info "Using Vercel CLI (npx vercel --prod)..."
    npx vercel --prod
    ok "Deployed via Vercel CLI."
    DEPLOYED=true
  fi
fi

# Neither available
if [[ "$DEPLOYED" = false ]]; then
  warn "Could not deploy automatically. Set up one of:"
  echo ""
  echo "  Option A — Git (recommended):"
  echo "    git init"
  echo "    git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git"
  echo "    Then connect the repo to Vercel at https://vercel.com/new"
  echo ""
  echo "  Option B — Vercel CLI:"
  echo "    npm i -g vercel"
  echo "    vercel login"
  echo "    Then re-run:  bash scripts/deploy.sh"
  echo ""
fi

# ── Final summary ──────────────────────────────────────────────────────────────
echo ""
if [[ "$DEPLOYED" = true ]]; then
  echo -e "${GREEN}${BOLD}✓ Pipeline complete. Data updated + deployed to Vercel.${RESET}"
else
  echo -e "${YELLOW}${BOLD}Pipeline complete. Data updated. Manual deploy needed (see above).${RESET}"
fi
echo ""
