import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { queryInputSchema, runQuery } from './tools/query.js';

const prisma = new PrismaClient({ log: [] });

const server = new Server(
  { name: 'cloudtalk-db', version: '2.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'query',
      description: [
        'Execute a read-only SQL SELECT statement directly against the PostgreSQL database.',
        '',
        'Schema tables:',
        '  users(id, email, display_name, password_hash, role, created_at, updated_at)',
        '  products(id, name, description, image_url, category, price, avg_rating, review_count, created_at, updated_at)',
        '  reviews(id, user_id, product_id, rating, title, body, status, created_at, updated_at)',
        '  review_votes(id, review_id, user_id, created_at)',
        '',
        'Only SELECT / WITH...SELECT / EXPLAIN / VALUES statements are permitted.',
        'Any query containing write or DDL keywords (INSERT, UPDATE, DELETE, DROP, etc.) is rejected before execution.',
      ].join('\n'),
      inputSchema: {
        type: 'object' as const,
        properties: {
          sql: {
            type: 'string',
            description: 'A read-only SQL SELECT statement to execute',
          },
        },
        required: ['sql'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const safeArgs = (args ?? {}) as Record<string, unknown>;

  try {
    if (name === 'query') {
      const input = queryInputSchema.parse(safeArgs);
      const text = await runQuery(input, prisma);
      return { content: [{ type: 'text' as const, text }] };
    }

    return {
      content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (e) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${e instanceof Error ? e.message : String(e)}`,
        },
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
