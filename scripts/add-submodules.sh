#!/usr/bin/env bash
# Register cloudtalk_homework_fe and cloudtalk_homework_be as git submodules.
# Prerequisites: both remotes must have at least one commit (run bootstrap-empty-remotes.sh once if needed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FE_URL="https://github.com/icreaterain/cloudtalk_homework_fe.git"
BE_URL="https://github.com/icreaterain/cloudtalk_homework_be.git"
FE_PATH="cloudtalk_homework_fe"
BE_PATH="cloudtalk_homework_be"

if [[ -f .gitmodules ]]; then
  echo ".gitmodules already exists — syncing submodules only."
  git submodule sync --recursive
  git submodule update --init --recursive
  exit 0
fi

require_remote_commit() {
  local url="$1" name="$2"
  if ! git ls-remote "$url" HEAD 2>/dev/null | grep -q .; then
    echo "Error: $name has no commits on the remote yet." >&2
    echo "Run ./scripts/bootstrap-empty-remotes.sh first (requires push access), then re-run this script." >&2
    exit 1
  fi
}

require_remote_commit "$FE_URL" "cloudtalk_homework_fe"
require_remote_commit "$BE_URL" "cloudtalk_homework_be"

if [[ -d "$FE_PATH" ]] || [[ -d "$BE_PATH" ]]; then
  echo "Error: remove or rename existing $FE_PATH / $BE_PATH directories before adding submodules." >&2
  exit 1
fi

echo "Adding submodules (requires non-empty remotes)..."
git submodule add "$FE_URL" "$FE_PATH"
git submodule add "$BE_URL" "$BE_PATH"

echo ""
echo "Submodules added. Commit in the workspace repo:"
echo "  git add .gitmodules $FE_PATH $BE_PATH"
echo "  git commit -m \"chore(workspace): add FE and BE as git submodules\""
