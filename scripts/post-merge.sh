#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Rebuild lib package declarations so downstream type-checks stay current
(cd lib/api-zod && npx tsc -p tsconfig.json)
(cd lib/db && npx tsc -p tsconfig.json)

pnpm --filter db push

# Push to GitHub mirror automatically after every merge
if [ -n "$GITHUB_TOKEN" ]; then
  REPO_URL="https://${GITHUB_TOKEN}@github.com/Victreebel/Code_Blue.git"
  git push "$REPO_URL" HEAD:main
else
  echo "Warning: GITHUB_TOKEN not set — skipping GitHub push"
fi
