#!/usr/bin/env bash
# Chronicle Aurora — Upstream Update
#
# Pull the latest Chronicle Aurora framework changes from upstream
# while keeping your local data/ (posts, config, assets) untouched.
#
# Usage:
#   bash scripts/update-app.sh
#
# What it does:
#   1. Switches to main branch (creates if tracking upstream/main)
#   2. Fetches latest from the upstream Chronicle Aurora repo
#   3. Merges upstream/main into main
#   4. Restores data/ to your local pre-merge state
#   5. Cleans up any new files from upstream's data/
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

# ── Locate repo root ─────────────────────────────────────────

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  err "Not in a git repository. Run this from your Chronicle Aurora downstream repo."
  exit 1
}
cd "$REPO_ROOT"

# ── Pre-flight checks ────────────────────────────────────────

# Uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  warn "You have uncommitted changes — these may cause merge conflicts."
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
UPSTREAM_BRANCH_NAME=$(echo "$UPSTREAM_BRANCH" | cut -d/ -f2-)  # "main" or "master"

if [ "$CURRENT_BRANCH" != "$UPSTREAM_BRANCH_NAME" ]; then
  say "→ Switching from $CURRENT_BRANCH to $UPSTREAM_BRANCH_NAME…"
  CHECKOUT_ERR=$(git checkout "$UPSTREAM_BRANCH_NAME" 2>&1) || {
    echo -e "${RED}$(echo "$CHECKOUT_ERR" | tail -10)${NC}"
    err "Cannot switch to $UPSTREAM_BRANCH_NAME. Stash or commit your changes first."
    exit 1
  }
fi

# ── Fetch & merge ────────────────────────────────────────────

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

say "🔀 Merging $UPSTREAM_BRANCH → $UPSTREAM_BRANCH_NAME ($UPSTREAM_COMMITS commit(s))"

PRE_MERGE_REF=$(git rev-parse HEAD)

MERGE_OUTPUT=$(git merge "$UPSTREAM_BRANCH" --no-edit --allow-unrelated-histories 2>&1) && MERGE_OK=true || MERGE_OK=false
if $MERGE_OK; then
  success "Merge clean"
else
  echo -e "${RED}$(echo "$MERGE_OUTPUT" | tail -20)${NC}"
  warn "Merge failed (see above). Checking for conflicts…"

  # Keep local version for any conflicted file under data/
  git diff --name-only --diff-filter=U 2>/dev/null | while read -r f; do
    if [[ "$f" == data/* ]]; then
      CO_ERR=$(git checkout --ours -- "$f" 2>&1) || {
        warn "Failed to restore local version of $f"
        echo -e "${RED}$(echo "$CO_ERR" | tail -5)${NC}"
      }
      git add "$f" 2>&1 || warn "Failed to stage $f"
    fi
  done

  REMAINING=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
  if [ -n "$REMAINING" ]; then
    err "Unresolved conflicts remain outside data/:"
    echo "$REMAINING"
    say ""
    say "Resolve them manually, then run:  git commit --no-edit"
    say "To abort the merge:               git merge --abort"
    exit 1
  fi

  COMMIT_ERR=$(git commit --no-edit 2>&1) || {
    echo -e "${RED}$(echo "$COMMIT_ERR" | tail -10)${NC}"
    err "Failed to commit conflict resolution."
    exit 1
  }
  success "Conflicts in data/ resolved — local version kept"
fi

# ── Restore data/ ────────────────────────────────────────────

say ""
say "🛡  Restoring local data/ to pre-merge state…"

# Reset all tracked files under data/ to their pre-merge versions
RESTORE_ERR=$(git checkout "$PRE_MERGE_REF" -- data/ 2>&1) || {
  echo -e "${RED}$(echo "$RESTORE_ERR" | tail -10)${NC}"
  err "Failed to restore data/ from pre-merge state."
  exit 1
}

# Remove any new untracked files that upstream's merge brought into data/
UNTRACKED=$(git ls-files --others --exclude-standard -- data/ 2>/dev/null || true)
if [ -n "$UNTRACKED" ]; then
  echo "$UNTRACKED" | while read -r f; do rm -f "$f"; done
  CLEAN_ERR=$(git clean -fd -- data/ 2>&1) || {
    echo -e "${RED}$(echo "$CLEAN_ERR" | tail -5)${NC}"
    warn "Could not clean all untracked files from data/"
  }
fi

success "data/ restored — your content is untouched"

# ── Report ───────────────────────────────────────────────────

say ""
say "┌──────────────────────────────────────────┐" "$GREEN"
say "│  ✅  Update complete!                     │" "$GREEN"
say "└──────────────────────────────────────────┘" "$GREEN"
say ""
say "  Framework updated to upstream."
say "  Your data/ is exactly as it was before."
say ""
say "  Review the changes:"
say "    git log ${PRE_MERGE_REF}..HEAD --oneline -- . ':!data'"
