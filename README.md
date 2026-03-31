# CloudTalk Homework — Product Review System

A full-stack product review system (similar to Amazon/Alza) built with Angular and Node.js.

## Repositories

This **workspace** repo aggregates the frontend and backend as **git submodules**:

| Path | Repo | Role |
|---|---|---|
| [`cloudtalk_homework_fe/`](./cloudtalk_homework_fe) | [`icreaterain/cloudtalk_homework_fe`](https://github.com/icreaterain/cloudtalk_homework_fe) | Angular frontend |
| [`cloudtalk_homework_be/`](./cloudtalk_homework_be) | [`icreaterain/cloudtalk_homework_be`](https://github.com/icreaterain/cloudtalk_homework_be) | Node.js REST API |

## Clone and setup

```bash
git clone --recurse-submodules https://github.com/icreaterain/cloudtalk_homework_workspace.git
cd cloudtalk_homework_workspace
./scripts/setup.sh
```

If you cloned without submodules:

```bash
git submodule update --init --recursive
./scripts/setup.sh
```

`setup.sh` syncs submodules and runs `npm install` in each repo when a `package.json` is present.

### Registering submodules (maintainers, first time)

Git cannot check out a submodule until the remote has at least one commit. If `cloudtalk_homework_fe` / `cloudtalk_homework_be` are still empty on GitHub:

1. Run `./scripts/bootstrap-empty-remotes.sh` (pushes a README to each repo — requires GitHub credentials).
2. Run `./scripts/add-submodules.sh` from the workspace root.
3. Commit `.gitmodules` and the submodule paths in this repo.

## Quick Start (application)

### Prerequisites
- Node.js 20+
- Docker Desktop

### 1. Start the database

```bash
docker compose up -d
```

### 2. Start the backend

```bash
cd cloudtalk_homework_be
cp .env.example .env        # edit if needed
npm run migrate
npm run dev
```

API runs at `http://localhost:3000`.

### 3. Start the frontend

```bash
cd cloudtalk_homework_fe
npm start
```

App runs at `http://localhost:4200`.

## Features

- Browse product catalog
- Read reviews and star ratings for each product
- Sign up and sign in (Firebase Authentication)
- Submit, edit, or delete your own review (one per product)

## Running Tests

```bash
# Backend
cd cloudtalk_homework_be && npm test

# Frontend
cd cloudtalk_homework_fe && npm test
```

## Documentation

- [WORKSPACE.md](WORKSPACE.md) — agentic workspace context, conventions, dependency graph
- [ARCHITECTURE.md](ARCHITECTURE.md) — current state system overview (stack, data model, API surface)
- [adr/](adr/README.md) — architecture decision records (reasoning behind each choice)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular, TypeScript |
| Backend | Node.js, TypeScript, (NestJS or Express — see [ADR 003](adr/003-backend-framework.md)) |
| Database | PostgreSQL |
| Auth | Firebase Authentication (API verifies Firebase ID tokens) |
| Local dev | Docker Compose |
