import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { listInputSchema, runList } from './tools/list.js';
import { getDetailsInputSchema, runGetDetails } from './tools/get-details.js';
import { executeInputSchema, runExecute } from './tools/execute.js';

const BASE_URL = (process.env['BASE_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');

const server = new Server(
  { name: 'galaxia-api', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list',
      description:
        'List all available REST endpoints and GraphQL queries with descriptions. Use this first to discover what the API can do.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          filter: {
            type: 'string',
            description:
              'Optional keyword to filter results (matches path, summary, tag, or query name)',
          },
        },
      },
    },
    {
      name: 'get_details',
      description:
        'Fetch the full schema of a specific REST endpoint or GraphQL query — parameters, request body, response shapes, and auth requirements. Pass the `id` returned by the `list` tool.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string',
            description:
              'The ID returned by `list`, e.g. "POST /api/auth/login" for REST or "query:products" for GraphQL.',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'execute',
      description:
        'Send a request to the CloudTalk API — REST (type: "rest") or GraphQL (type: "graphql"). Include the access token in headers for protected endpoints.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          type: {
            type: 'string',
            enum: ['rest', 'graphql'],
            description: '"rest" for REST endpoints, "graphql" for GraphQL queries',
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            description: '(REST only) HTTP method',
          },
          path: {
            type: 'string',
            description: '(REST only) Path relative to base URL, e.g. "/api/auth/login"',
          },
          body: {
            type: 'string',
            description: '(REST only) JSON-encoded request body string',
          },
          queryParams: {
            type: 'string',
            description: '(REST only) JSON-encoded query-string parameters object',
          },
          query: {
            type: 'string',
            description: '(GraphQL only) Full GraphQL query string',
          },
          variables: {
            type: 'string',
            description: '(GraphQL only) JSON-encoded variables object',
          },
          headers: {
            type: 'string',
            description: 'JSON-encoded headers, e.g. \'{"Authorization":"Bearer <token>"}\'',
          },
        },
        required: ['type'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const safeArgs = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case 'list': {
        const input = listInputSchema.parse(safeArgs);
        const text = await runList(input, BASE_URL);
        return { content: [{ type: 'text' as const, text }] };
      }

      case 'get_details': {
        const input = getDetailsInputSchema.parse(safeArgs);
        const text = await runGetDetails(input, BASE_URL);
        return { content: [{ type: 'text' as const, text }] };
      }

      case 'execute': {
        const input = executeInputSchema.parse(safeArgs);
        const text = await runExecute(input, BASE_URL);
        return { content: [{ type: 'text' as const, text }] };
      }

      default:
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (e) {
    return {
      content: [
        { type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` },
      ],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e: unknown) => {
  process.stderr.write(`Fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
