#!/usr/bin/env bash
# The scheduled refresh (.github/workflows/refresh-notices.yml) keeps the SQLite DB on an orphan
# branch "data" that holds only data/poc.db, always as ONE commit (force-pushed, no history).
#   bash scripts/data-branch.sh pull   origin/data:data/poc.db -> data/poc.db (fails if the branch is missing)
#   bash scripts/data-branch.sh push   data/poc.db -> origin/data as a single fresh commit
# `push` from your machine = (re)initialize the branch with your local DB. It replaces the DB the
# workflow has been updating, so pull first unless you mean to.
set -euo pipefail
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' # Git Bash on Windows: don't rewrite paths

cd "$(dirname "$0")/.."
BRANCH=data
DB=data/poc.db
REMOTE_URL=$(git remote get-url origin)

case "${1:-}" in
  pull)
    git fetch -q --depth=1 origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
    mkdir -p data
    git show "origin/$BRANCH:$DB" > "$DB.tmp"
    mv "$DB.tmp" "$DB"
    echo "[DATA] pulled $DB ($(wc -c < "$DB") bytes) from origin/$BRANCH"
    ;;
  push)
    [ -s "$DB" ] || { echo "[DATA] $DB is missing or empty; nothing pushed" >&2; exit 1; }
    # Relative, inside .git (never tracked): Git Bash's /tmp isn't visible to git.exe without path conversion
    TMP=$(mktemp -d .git/data-branch.XXXXXX)
    trap 'rm -rf "$TMP"' EXIT
    mkdir -p "$TMP/data"
    cp "$DB" "$TMP/$DB"
    git -C "$TMP" init -q -b "$BRANCH"
    git -C "$TMP" add "$DB"
    git -C "$TMP" -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" \
      commit -q -m "Notice DB snapshot $(date -u +%Y-%m-%dT%H:%MZ)"
    git -C "$TMP" push -q -f "$REMOTE_URL" "$BRANCH"
    echo "[DATA] pushed $DB ($(wc -c < "$DB") bytes) to origin/$BRANCH as a single commit"
    ;;
  *)
    echo "Usage: bash scripts/data-branch.sh pull|push" >&2
    exit 1
    ;;
esac
