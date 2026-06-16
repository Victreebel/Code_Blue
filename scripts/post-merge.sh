#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Rebuild lib package declarations so downstream type-checks stay current
(cd lib/api-zod && npx tsc -p tsconfig.json)
(cd lib/db && npx tsc -p tsconfig.json)

pnpm --filter db push

# Push to GitHub mirror automatically after every merge (10s budget)
if [ -n "$GITHUB_TOKEN" ]; then
  REPO_URL="https://${GITHUB_TOKEN}@github.com/Victreebel/Code_Blue.git"
  echo "Pushing to GitHub mirror..."
  if ! PUSH_OUTPUT=$(timeout 10 git push --force "$REPO_URL" HEAD:main 2>&1); then
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
  echo "GitHub mirror push succeeded."
else
  echo "Warning: GITHUB_TOKEN not set — skipping GitHub push"
fi
