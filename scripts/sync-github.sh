#!/bin/bash
# Periodically pushes local commits to the GitHub mirror.
# Runs as a persistent background workflow so changes made outside
# of task merges (manual edits, dependency bumps, config tweaks)
# are still reflected on GitHub within a reasonable window.

set -euo pipefail

if [ -n "${GITHUB_SYNC_INTERVAL:-}" ]; then
  if ! echo "$GITHUB_SYNC_INTERVAL" | grep -qE '^[1-9][0-9]*$'; then
    echo "Error: GITHUB_SYNC_INTERVAL must be a positive integer (got: '${GITHUB_SYNC_INTERVAL}')" >&2
    exit 1
  fi
fi

INTERVAL=${GITHUB_SYNC_INTERVAL:-300}  # seconds between pushes, default 5 min
FAIL_THRESHOLD=${GITHUB_SYNC_FAIL_THRESHOLD:-3}  # consecutive failures before alerting

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "Warning: GITHUB_TOKEN not set — GitHub sync disabled"
  exit 0
fi

REPO_URL="https://${GITHUB_TOKEN}@github.com/Victreebel/Code_Blue.git"

echo "GitHub sync started (push interval: ${INTERVAL}s${GITHUB_SYNC_INTERVAL:+ — set via GITHUB_SYNC_INTERVAL}, fail threshold: ${FAIL_THRESHOLD})"

consecutive_failures=0

while true; do
  sleep "$INTERVAL"

  LOCAL=$(git rev-parse HEAD 2>/dev/null || true)
  if [ -z "$LOCAL" ]; then
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] No commits yet — skipping"
    continue
  fi

  REMOTE=$(git ls-remote "$REPO_URL" refs/heads/main 2>/dev/null | awk '{print $1}' || true)

  if [ "$LOCAL" = "$REMOTE" ]; then
    consecutive_failures=0
    continue
  fi

  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Pushing to GitHub (local=$LOCAL remote=${REMOTE:-none})..."
  if git push --force "$REPO_URL" HEAD:main 2>&1; then
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Push succeeded"
    consecutive_failures=0
  else
    consecutive_failures=$((consecutive_failures + 1))
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Push failed — will retry next cycle (consecutive failures: ${consecutive_failures}/${FAIL_THRESHOLD})"
    if [ "$consecutive_failures" -ge "$FAIL_THRESHOLD" ]; then
      echo ""
      echo "ERROR: GitHub sync has failed ${consecutive_failures} times in a row — token may be revoked or remote may be rejecting pushes"
      echo "       Check GITHUB_TOKEN and the remote repository settings."
      echo ""
      exit 1
    fi
  fi
done
