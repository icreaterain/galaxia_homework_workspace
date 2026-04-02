# ADR 015 — MCP Server as API Wrapper

**Status:** Decided  
**Date:** 2026-04-02

---

## Context

AI agents (Cursor, Claude, etc.) benefit from structured, discoverable access to the
project's API. Without tooling, an agent must manually recall endpoints from documentation
or infer them from code — both error-prone approaches.

The backend exposes a hybrid REST + GraphQL API. We wanted a single, consistent way for
agents to:

1. **Discover** what endpoints and queries exist (with human-readable descriptions)
2. **Inspect** the parameters, request body, and response schema for any specific operation
3. **Invoke** the API directly — both REST and GraphQL — without leaving the AI context

## Decision

Implement a standalone **MCP (Model Context Protocol) server** (`mcp_service_wrapper/`)
in the workspace root. It wraps the running backend and exposes three tools over stdio:

| Tool | Description |
|---|---|
| `list` | Returns a high-level catalogue of all REST endpoints (from OpenAPI) and GraphQL queries (from `schema.graphql`). Accepts an optional `filter` keyword. |
| `get_details` | Returns the full parameter, request body, and response schema for a given endpoint or query. Identified by the `id` returned from `list`. |
| `execute` | Sends a request to the backend — REST (`type: "rest"`) or GraphQL (`type: "graphql"`). Accepts method, path, body, headers, and variables. |

The MCP server is registered in `.cursor/mcp.json` so Cursor loads it automatically.

### OpenAPI Source

To power the `list` and `get_details` tools with live API metadata, `@nestjs/swagger@^7`
was added to the backend. The spec is exposed at `GET /docs-json` (no UI, no extra
Fastify plugins required). Decorators were added to all controllers and DTOs.

### GraphQL Schema Source

The `schema.graphql` file already exists in the BE repo root (exported by
`pnpm run schema:export`). The MCP server reads it directly from the filesystem
(path configurable via `SCHEMA_PATH` env var).

### Technology Choices

- **`@modelcontextprotocol/sdk@^1`** — the official MCP SDK for Node.js
- **Low-level `Server` API** — used instead of `McpServer` to avoid TypeScript OOM
  during compilation (the `McpServer.tool()` overloads instantiate very deep Zod generics)
- **`zod@^3`** — runtime validation of tool inputs
- **CommonJS (`"type": "commonjs"`)** — avoids ESM/CJS interop issues with the SDK
- **Stdio transport** — the standard for Cursor-hosted MCP servers

## Alternatives Considered

| Alternative | Rejected because |
|---|---|
| In-process NestJS MCP plugin | Couples MCP to BE deployment; much heavier dependency |
| Hand-written static manifest | Drifts from the real API; maintenance burden |
| OpenAPI UI only (Swagger HTML) | Not machine-consumable; requires extra Fastify plugins |
| McpServer high-level API | TypeScript OOM during compilation with deep Zod generics |

## Consequences

- **New package** `mcp_service_wrapper/` at the workspace root (not a git submodule)
- **BE gets** `@nestjs/swagger@^7` and a `/docs-json` endpoint (no UI)
- The MCP server requires the **BE to be running** to serve the OpenAPI spec; the GraphQL
  schema is read from disk and works offline
- `SCHEMA_PATH` defaults to sibling `cloudtalk_homework_be/schema.graphql`; set the env
  var if the server runs from a different working directory
- After any BE API change, run `pnpm run build` in `cloudtalk_homework_mcp/` to rebuild

## Configuration

`.cursor/mcp.json` registers the server for Cursor:

```json
{
  "mcpServers": {
    "cloudtalk-api": {
      "command": "node",
      "args": [".../mcp_service_wrapper/dist/index.js"],
      "env": {
        "BASE_URL": "http://localhost:3000",
        "SCHEMA_PATH": ".../cloudtalk_homework_be/schema.graphql"
      }
    }
  }
}
```

For production: set `BASE_URL` to the Cloud Run URL.
