#!/usr/bin/env bash
# Clone submodule repositories, install all dependencies, and print run instructions.
# Run from the workspace root after clone: ./scripts/setup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── 1. Submodules ────────────────────────────────────────────────────────────
echo "==> Git: initialise and update submodules"
if [[ -f .gitmodules ]]; then
  git submodule sync --recursive
  git submodule update --init --recursive
  echo "    Submodules ready."
else
  echo "    No .gitmodules found — skipping submodule init."
  echo "    If this is the first time, run:"
  echo "      ./scripts/bootstrap-empty-remotes.sh && ./scripts/add-submodules.sh"
fi

# ── 2. Helpers ───────────────────────────────────────────────────────────────
install_pnpm() {
  local dir="$1"
  [[ -d "$dir" ]] || { echo "    $dir not found — skipping"; return 0; }
  if [[ -f "$dir/package.json" ]]; then
    echo "==> pnpm install in $dir"
    (cd "$dir" && pnpm install)
  else
    echo "    $dir: no package.json — skipping"
  fi
}

copy_env_example() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  if [[ -f "$dir/.env.example" ]] && [[ ! -f "$dir/.env" ]]; then
    echo "    $dir/.env not found — copying from .env.example"
    cp "$dir/.env.example" "$dir/.env"
  fi
}

# ── 3. Backend ───────────────────────────────────────────────────────────────
echo ""
echo "==> Backend (cloudtalk_homework_be)"
copy_env_example "cloudtalk_homework_be"
install_pnpm "cloudtalk_homework_be"

# ── 4. Frontend ──────────────────────────────────────────────────────────────
echo ""
echo "==> Frontend (cloudtalk_homework_fe)"
copy_env_example "cloudtalk_homework_fe"
install_pnpm "cloudtalk_homework_fe"

# ── 5. MCP packages ──────────────────────────────────────────────────────────
echo ""
echo "==> MCP servers"
for mcp_pkg in mcp/cloudtalk-api mcp/cloudtalk-db; do
  if [[ -d "$ROOT/$mcp_pkg" ]] && [[ -f "$ROOT/$mcp_pkg/package.json" ]]; then
    echo "    pnpm install + build in $mcp_pkg"
    (cd "$ROOT/$mcp_pkg" && pnpm install && pnpm run build)
  fi
done

# ── 6. Summary ───────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                        Setup complete!                              ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║                                                                      ║"
echo "║  HOW TO RUN THE PROJECT LOCALLY                                      ║"
echo "║                                                                      ║"
echo "║  Step 1 — Start PostgreSQL (Docker required)                         ║"
echo "║    docker compose up -d                                              ║"
echo "║                                                                      ║"
echo "║  Step 2 — Apply migrations (seed runs automatically on a fresh DB)     ║"
echo "║    cd cloudtalk_homework_be                                          ║"
echo "║    pnpm run migrate:local                                            ║"
echo "║    cd ..                                                             ║"
echo "║                                                                      ║"
echo "║    If the DB already has migrations but no data, seed manually:      ║"
echo "║    cd cloudtalk_homework_be && pnpm run seed && cd ..               ║"
echo "║                                                                      ║"
echo "║  Step 3 — Start the backend API                                      ║"
echo "║    cd cloudtalk_homework_be && pnpm run dev                          ║"
echo "║    → http://localhost:3000                                           ║"
echo "║    → http://localhost:3000/graphql  (GraphQL Playground)             ║"
echo "║                                                                      ║"
echo "║  Step 4 — Start the frontend (separate terminal)                     ║"
echo "║    cd cloudtalk_homework_fe && pnpm run codegen && pnpm start        ║"
echo "║    → http://localhost:4200                                           ║"
echo "║                                                                      ║"
echo "║  Demo credentials (seeded)                                           ║"
echo "║    user@demo.com  / password123                                      ║"
echo "║    admin@demo.com / password123                                      ║"
echo "║                                                                      ║"
echo "║  Notes                                                               ║"
echo "║  • .env was auto-copied from .env.example if missing.               ║"
echo "║    Review cloudtalk_homework_be/.env for DB / JWT settings.         ║"
echo "║  • pnpm run codegen must be re-run after any GraphQL schema change.  ║"
echo "║  • MCP servers are built and ready in mcp/cloudtalk-{api,db}/.      ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
