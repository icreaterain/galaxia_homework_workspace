#!/usr/bin/env bash
# One-time: ensure both GitHub repos have at least one commit on main.
# Required before scripts/add-submodules.sh (empty remotes cannot be checked out as submodules).
set -euo pipefail

FE_URL="https://github.com/icreaterain/cloudtalk_homework_fe.git"
BE_URL="https://github.com/icreaterain/cloudtalk_homework_be.git"

bootstrap_repo() {
  local url="$1" title="$2" body="$3"
  local tmp
  tmp="$(mktemp -d)"
  git clone "$url" "$tmp/repo"
  cd "$tmp/repo"

  if git rev-parse HEAD >/dev/null 2>&1; then
    echo "==> $url — already has commits; skipping."
    rm -rf "$tmp"
    return 0
  fi

  printf '%s\n\n%s\n\n%s\n' "$title" "$body" "See the workspace repo for setup: https://github.com/icreaterain/cloudtalk_homework_workspace" > README.md
  git add README.md
  git commit -m "chore: initial commit"
  git branch -M main
  echo "==> Pushing initial commit to $url ..."
  git push -u origin main
  rm -rf "$tmp"
  echo "    Done."
}

bootstrap_repo "$FE_URL" "# cloudtalk_homework_fe" "Angular frontend for the CloudTalk homework product review system."
bootstrap_repo "$BE_URL" "# cloudtalk_homework_be" "Node.js REST API for the CloudTalk homework product review system."

echo ""
echo "Remotes are ready. From the workspace root, run:"
echo "  ./scripts/add-submodules.sh"
