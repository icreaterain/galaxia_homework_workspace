# ADR 016 — MCP Server for Direct Database Reads

**Status:** Decided  
**Date:** 2026-04-02

---

## Context

ADR 015 introduced `mcp/galaxia-api` — an MCP server that wraps the running REST + GraphQL backend. That server is useful for invoking API operations, but it requires the NestJS process to be running and goes through HTTP, which limits what an agent can query (pagination, filters, raw counts, etc.).

For agent tasks like debugging data quality issues, exploring seed data, auditing review statuses, or answering ad-hoc questions about the dataset, direct database access provides:

- Richer filtering (multi-field, cross-model counts, arbitrary pagination)
- No dependency on the running API
- Aggregate statistics not exposed by the current GraphQL schema
- Access to all review statuses (including `flagged` / `removed`) for moderation workflows

## Decision

Add a second MCP server at `mcp/galaxia-db/` that connects directly to PostgreSQL via its own `@prisma/client` instance and exposes a single general-purpose read-only tool:

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
├── galaxia-api/   ← API wrapper (ADR 015, moved from mcp_service_wrapper/)
└── galaxia-db/    ← direct DB reader (this ADR)
    ├── prisma/schema.prisma   ← symlink → galaxia_homework_be/prisma/schema.prisma
    ├── src/
    │   ├── index.ts
    │   └── tools/
    │       └── query.ts       ← assertReadOnly() guard + $queryRawUnsafe execution
    └── package.json
```

## Technology Choices

- **`@prisma/client@^6`** — same major version as the backend
- **Symlinked `prisma/schema.prisma`** — `mcp/galaxia-db/prisma/schema.prisma` is a symlink to `galaxia_homework_be/prisma/schema.prisma`; Prisma discovers the schema at its apparent path so it resolves `@prisma/client` from the MCP's own `node_modules`, avoiding any version mismatch with the BE
- **`pnpm.onlyBuiltDependencies`** — enables Prisma engine postinstall scripts without interactive `pnpm approve-builds`
- **CommonJS** — consistent with `galaxia-api` to avoid ESM/CJS interop

## Schema Sync

`mcp/galaxia-db/prisma/schema.prisma` is a symlink to the BE schema — there is no copy to maintain. When BE models change:

1. Update `galaxia_homework_be/prisma/schema.prisma` as normal
2. Run `pnpm run generate` and `pnpm run build` in `mcp/galaxia-db/`

## Configuration

`.cursor/mcp.json` (and workspace root `mcp.json`) registers both servers:

```json
{
  "mcpServers": {
    "galaxia-api": { ... },
    "galaxia-db": {
      "command": "pnpm",
      "args": ["--dir", "mcp/galaxia-db", "exec", "node", "dist/index.js"],
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
| Extend `galaxia-api` with DB tools | Mixes concerns; `galaxia-api` requires API to be up |
| Entity-specific tools (list_products, get_product, …) | Each tool only covers one model; an agent needs SQL anyway for JOINs, aggregates, or ad-hoc analysis — a raw `query` tool is strictly more powerful |
| Raw `pg` client with SQL strings | Verbose; no type safety on the host side; Prisma already present |
| GraphQL queries with extended schema | Would require BE changes and API to be running |
| Shared Prisma client from BE submodule | Couples MCP to BE's `node_modules`; fragile path dependency — the symlink approach shares the schema *content* only; each package keeps its own `node_modules` and Prisma version |

## Consequences

- **New package** `mcp/galaxia-db/` at workspace root
- Both MCP packages now live under `mcp/`; old `mcp_service_wrapper/` directory removed
- Requires `DATABASE_URL` to point to a running Postgres instance
- No separate schema copy — `mcp/galaxia-db/prisma/schema.prisma` is a symlink; updating the BE schema automatically updates the MCP schema
