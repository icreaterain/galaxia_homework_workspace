#!/usr/bin/env bash
# Pull latest submodule commits and install dependencies (when package.json exists).
# Run from the workspace root after clone: ./scripts/setup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Git: sync and update submodules"
if [[ -f .gitmodules ]]; then
  git submodule sync --recursive
  git submodule update --init --recursive
else
  echo "    No .gitmodules found — skipping submodule init."
  echo "    If this is the first time, run: ./scripts/bootstrap-empty-remotes.sh && ./scripts/add-submodules.sh"
fi

install_pnpm() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  if [[ -f "$dir/package.json" ]]; then
    echo "==> pnpm install in $dir"
    (cd "$dir" && pnpm install)
  else
    echo "==> $dir: no package.json yet — skipping pnpm install"
  fi
}

install_pnpm "cloudtalk_homework_be"
install_pnpm "cloudtalk_homework_fe"

if [[ -f "$ROOT/docker-compose.yml" ]] || [[ -f "$ROOT/compose.yml" ]]; then
  echo "==> Docker Compose file present — not starting automatically."
  echo "    To start Postgres: docker compose up -d"
fi

echo ""
echo "Setup finished."
