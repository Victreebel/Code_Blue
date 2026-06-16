#!/bin/bash
# Periodically pushes local commits to the GitHub mirror.
# Runs as a persistent background workflow so changes made outside
# of task merges (manual edits, dependency bumps, config tweaks)
# are still reflected on GitHub within a reasonable window.

set -euo pipefail

INTERVAL=${GITHUB_SYNC_INTERVAL:-300}  # seconds between pushes, default 5 min

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "Warning: GITHUB_TOKEN not set — GitHub sync disabled"
  exit 0
fi

REPO_URL="https://${GITHUB_TOKEN}@github.com/Victreebel/Code_Blue.git"

echo "GitHub sync started (push interval: ${INTERVAL}s)"

while true; do
  sleep "$INTERVAL"

  LOCAL=$(git rev-parse HEAD 2>/dev/null || true)
  if [ -z "$LOCAL" ]; then
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] No commits yet — skipping"
    continue
  fi

  REMOTE=$(git ls-remote "$REPO_URL" refs/heads/main 2>/dev/null | awk '{print $1}' || true)

  if [ "$LOCAL" = "$REMOTE" ]; then
    continue
  fi

  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Pushing to GitHub (local=$LOCAL remote=${REMOTE:-none})..."
  if git push "$REPO_URL" HEAD:main 2>&1; then
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Push succeeded"
  else
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Push failed — will retry next cycle"
  fi
done
