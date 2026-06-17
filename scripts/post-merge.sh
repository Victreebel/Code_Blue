#!/bin/bash
set -e

# --- Preflight: check GITHUB_TOKEN before any build work ---
if [ -z "$GITHUB_TOKEN" ]; then
  echo "WARNING: GITHUB_TOKEN is not set — GitHub mirror push will be skipped." >&2
  echo "         Set GITHUB_TOKEN in your environment secrets to enable automatic mirroring." >&2
else
  # Lightweight validation: hit the GitHub API with the token to confirm it's valid
  GH_CHECK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    https://api.github.com/user)
  if [ "$GH_CHECK_STATUS" != "200" ]; then
    echo "ERROR: GITHUB_TOKEN appears to be invalid or expired (HTTP $GH_CHECK_STATUS from api.github.com)." >&2
    echo "       Update the token in your environment secrets before pushing." >&2
    exit 1
  fi
fi

pnpm install --frozen-lockfile

# Rebuild lib package declarations so downstream type-checks stay current
(cd lib/api-zod && npx tsc -p tsconfig.json)
(cd lib/db && npx tsc -p tsconfig.json)

pnpm --filter db push

# Push to GitHub mirror automatically after every merge (10s budget)
SYNC_LOG="logs/github-sync.log"
mkdir -p logs
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ -n "$GITHUB_TOKEN" ]; then
  REPO_URL="https://${GITHUB_TOKEN}@github.com/Victreebel/Code_Blue.git"
  echo "Pushing to GitHub mirror..."
  if PUSH_OUTPUT=$(timeout 10 git push --force "$REPO_URL" HEAD:main 2>&1); then
    {
      echo "[$TIMESTAMP] SUCCESS (exit 0)"
      echo "$PUSH_OUTPUT"
      echo "---"
    } >> "$SYNC_LOG"
    echo "GitHub mirror push succeeded."
  else
    EXIT_CODE=$?
    {
      echo "[$TIMESTAMP] FAILURE (exit $EXIT_CODE)"
      echo "$PUSH_OUTPUT"
      echo "---"
    } >> "$SYNC_LOG"
    echo "ERROR: GitHub mirror push failed" >&2
    echo "--- git push output ---" >&2
    echo "$PUSH_OUTPUT" >&2
    echo "--- end output ---" >&2
    if echo "$PUSH_OUTPUT" | grep -qi "authentication\|credentials\|403\|401\|token"; then
      echo "Likely cause: GITHUB_TOKEN is expired or lacks push permission." >&2
    elif echo "$PUSH_OUTPUT" | grep -qi "rejected\|non-fast-forward\|diverged\|fetch first"; then
      echo "Likely cause: remote branch has diverged — a force-push or rebase may be needed." >&2
    elif echo "$PUSH_OUTPUT" | grep -qi "could not resolve\|unable to connect\|network\|timeout"; then
      echo "Likely cause: network error reaching github.com (or push timed out after 10s)." >&2
    fi
    exit 1
  fi
else
  {
    echo "[$TIMESTAMP] SKIPPED — GITHUB_TOKEN not set"
    echo "---"
  } >> "$SYNC_LOG"
  echo "Warning: GITHUB_TOKEN not set — skipping GitHub push"
fi
