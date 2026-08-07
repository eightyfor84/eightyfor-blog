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
#   Everything outside data/  → upstream wins (framework update)
#   Everything inside data/   → local wins (your content, always)
#
#   Achieved via .git/info/attributes (data/* merge=ours) + -X theirs.
#   .git/info/attributes is not tracked — upstream merges can't touch it.
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

# ── One-time setup: merge driver for data/ ────────────────────
#
# Uses .git/info/attributes (NOT .gitattributes) so upstream
# merges can never overwrite this configuration.

GIT_ATTR=".git/info/attributes"
ATTR_LINE="data/* merge=ours"

if ! git config merge.ours.driver &>/dev/null; then
  say "→ Configuring merge.ours.driver (one-time setup)…"
  git config merge.ours.driver true
fi

if ! grep -qF "$ATTR_LINE" "$GIT_ATTR" 2>/dev/null; then
  say "→ Adding data/* merge=ours to .git/info/attributes (one-time setup)…"
  mkdir -p "$(dirname "$GIT_ATTR")"
  echo "$ATTR_LINE" >> "$GIT_ATTR"
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
say "   data/* → local wins   |   everything else → upstream wins"

PRE_MERGE_REF=$(git rev-parse HEAD)

MERGE_OUTPUT=$(git merge "$UPSTREAM_BRANCH" --no-edit --allow-unrelated-histories -X theirs 2>&1) && MERGE_OK=true || MERGE_OK=false
if $MERGE_OK; then
  success "Merge complete"
else
  echo -e "${RED}$(echo "$MERGE_OUTPUT" | tail -20)${NC}"
  err "Merge failed unexpectedly."
  say "To abort:  git merge --abort"
  exit 1
fi

# ── Clean up data/ files introduced by upstream ───────────────
#
# .gitattributes merge=ours handles conflicts on existing files.
# But files that ONLY exist in upstream (no local counterpart)
# are not conflicts — git adds them. This removes those.

NEW_DATA_FILES=$(git diff --name-only --diff-filter=A "$PRE_MERGE_REF" -- data/ 2>/dev/null || true)
if [ -n "$NEW_DATA_FILES" ]; then
  say ""
  say "🧹 Removing data/ files introduced by upstream…"
  echo "$NEW_DATA_FILES" | while read -r f; do
    say "   rm $f"
    git rm --cached -- "$f" 2>/dev/null || true
    rm -f "$f"
  done
  # Also clean untracked data/ files
  git clean -fd -- data/ 2>/dev/null || true
fi

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
