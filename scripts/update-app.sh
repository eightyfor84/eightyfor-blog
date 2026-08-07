#!/usr/bin/env bash
# Chronicle Aurora — Upstream Update
#
# Pull the latest Chronicle Aurora framework changes from upstream
# while keeping your local data/ (posts, config, assets) untouched.
#
# Usage:
#   bash scripts/update-app.sh
#
# Strategy:
#   Backup data/ → merge upstream → restore data/ from backup.
#   No merge strategies, no .gitattributes — just replace the
#   entire data/ tree with the pre-merge version. Simple and reliable.
#
# The upstream remote is auto-detected from git:
#   1. "upstream" remote if present
#   2. "origin" if its URL contains "chronicle-aurora"
#   3. Otherwise exits with instructions

set -euo pipefail

# ── Helpers ──────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

say()    { echo -e "${2:-}$1${NC}"; }
success(){ say "✓ $1" "$GREEN"; }
warn()   { say "⚠ $1" "$YELLOW"; }
err()    { say "✗ $1" "$RED"; }

cleanup() {
  if [ -n "${BACKUP_DIR:-}" ] && [ -d "$BACKUP_DIR" ]; then
    rm -rf "$BACKUP_DIR"
  fi
}
trap cleanup EXIT

# ── Locate repo root ─────────────────────────────────────────

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  err "Not in a git repository. Run this from your Chronicle Aurora downstream repo."
  exit 1
}
cd "$REPO_ROOT"

# ── Pre-flight checks ────────────────────────────────────────

# Uncommitted changes (excluding data/ — we handle that separately)
if ! git diff-index --quiet HEAD -- . ':!data' 2>/dev/null; then
  warn "You have uncommitted changes outside data/ — these may cause merge conflicts."
  read -rp "        Continue anyway? [y/N] " answer
  [[ "${answer,,}" =~ ^y ]] || exit 0
fi

# Auto-detect upstream remote
UPSTREAM_REMOTE=""
if git remote get-url upstream &>/dev/null; then
  UPSTREAM_REMOTE="upstream"
elif git remote get-url origin &>/dev/null; then
  ORIGIN_URL=$(git remote get-url origin)
  if echo "$ORIGIN_URL" | grep -qi "chronicle-aurora"; then
    UPSTREAM_REMOTE="origin"
  fi
fi

if [ -z "$UPSTREAM_REMOTE" ]; then
  err "Could not auto-detect the Chronicle Aurora upstream remote."
  say ""
  say "  None of these matched:"
  say "    1. A remote named \"upstream\""
  say "    2. An \"origin\" remote whose URL contains \"chronicle-aurora\""
  say ""
  say "  Add the upstream remote manually, for example:"
  say "    git remote add upstream https://github.com/eightyfor/chronicle-aurora.git"
  exit 1
fi

UPSTREAM_URL=$(git remote get-url "$UPSTREAM_REMOTE")
say "→ Using upstream: $UPSTREAM_REMOTE ($UPSTREAM_URL)"

# ── Ensure on main branch ────────────────────────────────────

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Detect upstream default branch
UPSTREAM_BRANCH="$UPSTREAM_REMOTE/main"
if ! git rev-parse --verify "$UPSTREAM_BRANCH" &>/dev/null; then
  UPSTREAM_BRANCH="$UPSTREAM_REMOTE/master"
fi
UPSTREAM_BRANCH_NAME=$(echo "$UPSTREAM_BRANCH" | cut -d/ -f2-)

if [ "$CURRENT_BRANCH" != "$UPSTREAM_BRANCH_NAME" ]; then
  say "→ Switching from $CURRENT_BRANCH to $UPSTREAM_BRANCH_NAME…"
  CHECKOUT_ERR=$(git checkout "$UPSTREAM_BRANCH_NAME" 2>&1) || {
    echo -e "${RED}$(echo "$CHECKOUT_ERR" | tail -10)${NC}"
    err "Cannot switch to $UPSTREAM_BRANCH_NAME. Stash or commit your changes first."
    exit 1
  }
fi

# ── Fetch ────────────────────────────────────────────────────

say ""
say "┌──────────────────────────────────────────┐" "$BOLD"
say "│  Chronicle Aurora — Upstream Update      │" "$BOLD"
say "└──────────────────────────────────────────┘" "$BOLD"
say ""

say "📡 Fetching $UPSTREAM_REMOTE…"
FETCH_ERR=$(git fetch "$UPSTREAM_REMOTE" 2>&1) || {
  echo -e "${RED}$(echo "$FETCH_ERR" | tail -10)${NC}"
  err "Fetch failed. Check your network and the remote URL: $UPSTREAM_URL"
  exit 1
}

UPSTREAM_COMMITS=$(git rev-list --count "HEAD..$UPSTREAM_BRANCH" 2>/dev/null || echo 0)

if [ "$UPSTREAM_COMMITS" -eq 0 ]; then
  success "Already up to date (no new upstream commits)."
  exit 0
fi

# ── Backup data/ ─────────────────────────────────────────────

say ""
say "📦 Backing up data/…"

BACKUP_DIR=$(mktemp -d)
if [ -d data ]; then
  cp -r data "$BACKUP_DIR/"
  success "data/ backed up ($(du -sh data | cut -f1))"
else
  warn "No data/ directory found — nothing to back up"
fi

# ── Merge ────────────────────────────────────────────────────

say ""
say "🔀 Merging $UPSTREAM_BRANCH → $UPSTREAM_BRANCH_NAME ($UPSTREAM_COMMITS commit(s))"

PRE_MERGE_REF=$(git rev-parse HEAD)

MERGE_OUTPUT=$(git merge "$UPSTREAM_BRANCH" --no-edit --allow-unrelated-histories -X theirs 2>&1) && MERGE_OK=true || MERGE_OK=false
if ! $MERGE_OK; then
  echo -e "${RED}$(echo "$MERGE_OUTPUT" | tail -20)${NC}"
  err "Merge failed."
  say "To abort:  git merge --abort"
  exit 1
fi
success "Merge complete"

# ── Restore data/ ────────────────────────────────────────────

say ""
say "🛡  Restoring data/ from backup…"

# Remove whatever the merge put in data/
git rm -rf --cached --quiet data/ 2>/dev/null || true
rm -rf data/

# Restore from backup
if [ -d "$BACKUP_DIR/data" ]; then
  cp -r "$BACKUP_DIR/data" data
  git add data/
else
  # No local data/ existed — also remove any upstream data/ from the merge
  say "   No local data/ to restore — upstream data/ removed"
fi

# Amend the merge commit so data/ is correct in history
git commit --amend --no-edit 2>&1 || {
  warn "Could not amend merge commit — data/ changes are staged, commit them manually."
}

success "data/ restored — your content is untouched"

# ── Report ───────────────────────────────────────────────────

say ""
say "┌──────────────────────────────────────────┐" "$GREEN"
say "│  ✅  Update complete!                     │" "$GREEN"
say "└──────────────────────────────────────────┘" "$GREEN"
say ""
say "  Framework updated to upstream."
say "  data/ = your local version (backup → restore)."
say ""
say "  Review the changes:"
say "    git log ${PRE_MERGE_REF}..HEAD --oneline -- . ':!data'"
