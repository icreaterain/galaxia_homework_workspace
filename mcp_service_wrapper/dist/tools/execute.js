"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeInputSchema = void 0;
exports.runExecute = runExecute;
const zod_1 = require("zod");
/**
 * Flat schema accepted by McpServer.tool() — the discriminated logic is applied at runtime.
 * For REST: provide type="rest", method, path, and optionally body/headers/queryParams.
 * For GraphQL: provide type="graphql", query, and optionally variables/headers.
 */
exports.executeInputSchema = zod_1.z.object({
    type: zod_1.z
        .enum(['rest', 'graphql'])
        .describe('"rest" to call a REST endpoint, "graphql" to send a GraphQL query'),
    // REST fields
    method: zod_1.z
        .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
        .optional()
        .describe('(REST only) HTTP method'),
    path: zod_1.z
        .string()
        .optional()
        .describe('(REST only) Path relative to the API base, e.g. "/api/auth/login"'),
    body: zod_1.z
        .string()
        .optional()
        .describe('(REST only) JSON-encoded request body string (for POST/PUT/PATCH)'),
    queryParams: zod_1.z
        .string()
        .optional()
        .describe('(REST only) JSON-encoded query-string parameters object, e.g. \'{"page":"1"}\''),
    // GraphQL fields
    query: zod_1.z
        .string()
        .optional()
        .describe('(GraphQL only) Full GraphQL query string'),
    variables: zod_1.z
        .string()
        .optional()
        .describe('(GraphQL only) JSON-encoded variables object'),
    // Common
    headers: zod_1.z
        .string()
        .optional()
        .describe('JSON-encoded headers object, e.g. \'{"Authorization":"Bearer <token>"}\''),
});
function parseJsonField(raw, fieldName) {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new TypeError(`${fieldName} must be a JSON object`);
        }
        return parsed;
    }
    catch (e) {
        throw new Error(`Invalid JSON in "${fieldName}": ${e instanceof Error ? e.message : String(e)}`);
    }
}
async function runExecute(input, baseUrl) {
    if (input.type === 'rest') {
        if (!input.method)
            throw new Error('"method" is required for REST requests');
        if (!input.path)
            throw new Error('"path" is required for REST requests');
        return executeRest(input, baseUrl);
    }
    if (!input.query)
        throw new Error('"query" is required for GraphQL requests');
    return executeGraphql(input, baseUrl);
}
async function executeRest(input, baseUrl) {
    const headers = parseJsonField(input.headers, 'headers');
    const queryParams = parseJsonField(input.queryParams, 'queryParams');
    const url = new URL(`${baseUrl}${input.path}`);
    for (const [k, v] of Object.entries(queryParams)) {
        url.searchParams.set(k, String(v));
    }
    const fetchHeaders = {
        'Content-Type': 'application/json',
        ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)])),
    };
    const fetchOptions = {
        method: input.method,
        headers: fetchHeaders,
    };
    if (input.body && ['POST', 'PUT', 'PATCH'].includes(input.method)) {
        // Validate JSON before sending
        try {
            JSON.parse(input.body);
        }
        catch {
            throw new Error('body is not valid JSON');
        }
        fetchOptions.body = input.body;
    }
    const res = await fetch(url.toString(), fetchOptions);
    return formatResponse(res);
}
async function executeGraphql(input, baseUrl) {
    const headers = parseJsonField(input.headers, 'headers');
    const variables = input.variables ? parseJsonField(input.variables, 'variables') : {};
    const res = await fetch(`${baseUrl}/graphql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)])),
        },
        body: JSON.stringify({ query: input.query, variables }),
    });
    return formatResponse(res);
}
async function formatResponse(res) {
    const statusLine = `HTTP ${res.status} ${res.statusText}`;
    const contentType = res.headers.get('content-type') ?? '';
    let body;
    if (contentType.includes('application/json')) {
        try {
            const json = await res.json();
            body = JSON.stringify(json, null, 2);
        }
        catch {
            body = await res.text();
        }
    }
    else {
        body = await res.text();
    }
    const lines = [statusLine, ''];
    if (body) {
        lines.push(body);
    }
    return lines.join('\n');
}
//# sourceMappingURL=execute.js.map