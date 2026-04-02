"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const list_js_1 = require("./tools/list.js");
const get_details_js_1 = require("./tools/get-details.js");
const execute_js_1 = require("./tools/execute.js");
const BASE_URL = (process.env['BASE_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');
const server = new index_js_1.Server({ name: 'cloudtalk-api', version: '1.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'list',
            description: 'List all available REST endpoints and GraphQL queries with descriptions. Use this first to discover what the API can do.',
            inputSchema: {
                type: 'object',
                properties: {
                    filter: {
                        type: 'string',
                        description: 'Optional keyword to filter results (matches path, summary, tag, or query name)',
                    },
                },
            },
        },
        {
            name: 'get_details',
            description: 'Fetch the full schema of a specific REST endpoint or GraphQL query — parameters, request body, response shapes, and auth requirements. Pass the `id` returned by the `list` tool.',
            inputSchema: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'The ID returned by `list`, e.g. "POST /api/auth/login" for REST or "query:products" for GraphQL.',
                    },
                },
                required: ['id'],
            },
        },
        {
            name: 'execute',
            description: 'Send a request to the CloudTalk API — REST (type: "rest") or GraphQL (type: "graphql"). Include the access token in headers for protected endpoints.',
            inputSchema: {
                type: 'object',
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
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const safeArgs = (args ?? {});
    try {
        switch (name) {
            case 'list': {
                const input = list_js_1.listInputSchema.parse(safeArgs);
                const text = await (0, list_js_1.runList)(input, BASE_URL);
                return { content: [{ type: 'text', text }] };
            }
            case 'get_details': {
                const input = get_details_js_1.getDetailsInputSchema.parse(safeArgs);
                const text = await (0, get_details_js_1.runGetDetails)(input, BASE_URL);
                return { content: [{ type: 'text', text }] };
            }
            case 'execute': {
                const input = execute_js_1.executeInputSchema.parse(safeArgs);
                const text = await (0, execute_js_1.runExecute)(input, BASE_URL);
                return { content: [{ type: 'text', text }] };
            }
            default:
                return {
                    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
    }
    catch (e) {
        return {
            content: [
                { type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` },
            ],
            isError: true,
        };
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    process.stderr.write(`Fatal: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map