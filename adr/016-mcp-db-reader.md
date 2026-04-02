# ADR 016 — MCP Server for Direct Database Reads

**Status:** Decided  
**Date:** 2026-04-02

---

## Context

ADR 015 introduced `mcp/cloudtalk-api` — an MCP server that wraps the running REST + GraphQL backend. That server is useful for invoking API operations, but it requires the NestJS process to be running and goes through HTTP, which limits what an agent can query (pagination, filters, raw counts, etc.).

For agent tasks like debugging data quality issues, exploring seed data, auditing review statuses, or answering ad-hoc questions about the dataset, direct database access provides:

- Richer filtering (multi-field, cross-model counts, arbitrary pagination)
- No dependency on the running API
- Aggregate statistics not exposed by the current GraphQL schema
- Access to all review statuses (including `flagged` / `removed`) for moderation workflows

## Decision

Add a second MCP server at `mcp/cloudtalk-db/` that connects directly to PostgreSQL via its own `@prisma/client` instance and exposes a single general-purpose read-only tool:

| Tool | Description |
|---|---|
| `query` | Execute any SQL `SELECT` (or `WITH…SELECT`, `EXPLAIN`, `VALUES`) directly against the database. Returns results formatted as a plain-text table. |

The tool enforces **read-only access** before the query reaches the database:
1. Strip SQL comments (`--` and `/* */`)
2. Require the first keyword to be in an allowlist: `SELECT`, `WITH`, `TABLE`, `EXPLAIN`, `SHOW`, `VALUES`
3. Scan the full statement for any forbidden write/DDL keyword (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `CALL`, `EXECUTE`, …) as whole words — catching CTE-wrapped mutations like `WITH x AS (DELETE …) SELECT …`

No writes, no DDL, no mutations.

## Repository Layout

```
mcp/
├── cloudtalk-api/   ← API wrapper (ADR 015, moved from mcp_service_wrapper/)
└── cloudtalk-db/    ← direct DB reader (this ADR)
    ├── prisma/schema.prisma   ← symlink to `cloudtalk_homework_be/prisma/schema.prisma`
    ├── src/
    │   ├── index.ts
    │   └── tools/
    │       └── query.ts       ← assertReadOnly() guard + $queryRawUnsafe execution
    └── package.json
```

## Technology Choices

- **`@prisma/client@^6`** — same major version as the backend; client is generated into this package’s `node_modules` while the schema file is a symlink to the backend’s `prisma/schema.prisma` (no duplicate models)
- **`prisma/schema.prisma`** — symbolic link to `cloudtalk_homework_be/prisma/schema.prisma` so `prisma generate` stays aligned with the API automatically (`binaryTargets`, `directUrl`, and migrations stay owned by the BE)
- **`pnpm.onlyBuiltDependencies`** — enables Prisma engine postinstall scripts without interactive `pnpm approve-builds`
- **CommonJS** — consistent with `cloudtalk-api` to avoid ESM/CJS interop

## Schema sync

The MCP does not maintain a separate schema file. After backend Prisma schema or model changes, regenerate the client in this package:

1. `cd mcp/cloudtalk-db && pnpm run generate`
2. `pnpm run build` (if TypeScript types need to match generated client)

The schema path is a symbolic link; on Windows, ensure Git checks out symlinks (`core.symlinks` / Developer Mode) or recreate the link to `cloudtalk_homework_be/prisma/schema.prisma` if the file appears as plain text.

## Configuration

`.cursor/mcp.json` (and workspace root `mcp.json`) registers both servers:

```json
{
  "mcpServers": {
    "cloudtalk-api": { ... },
    "cloudtalk-db": {
      "command": "pnpm",
      "args": ["--dir", "mcp/cloudtalk-db", "exec", "node", "dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/reviews_dev"
      }
    }
  }
}
```

For production: set `DATABASE_URL` to the Supabase direct URL (port 5432).

## Alternatives Considered

| Alternative | Rejected because |
|---|---|
| Extend `cloudtalk-api` with DB tools | Mixes concerns; `cloudtalk-api` requires API to be up |
| Entity-specific tools (list_products, get_product, …) | Each tool only covers one model; an agent needs SQL anyway for JOINs, aggregates, or ad-hoc analysis — a raw `query` tool is strictly more powerful |
| Raw `pg` client with SQL strings | Verbose; no type safety on the host side; Prisma already present |
| GraphQL queries with extended schema | Would require BE changes and API to be running |
| Shared Prisma client from BE submodule | Couples MCP to BE's `node_modules`; fragile path dependency |

## Consequences

- **New package** `mcp/cloudtalk-db/` at workspace root
- Both MCP packages now live under `mcp/`; old `mcp_service_wrapper/` directory removed
- Requires `DATABASE_URL` to point to a running Postgres instance
- Schema copy must be kept in sync with BE schema when models change
