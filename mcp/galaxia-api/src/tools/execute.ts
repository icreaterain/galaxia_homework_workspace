import { z } from 'zod';

/**
 * Flat schema accepted by McpServer.tool() — the discriminated logic is applied at runtime.
 * For REST: provide type="rest", method, path, and optionally body/headers/queryParams.
 * For GraphQL: provide type="graphql", query, and optionally variables/headers.
 */
export const executeInputSchema = z.object({
  type: z
    .enum(['rest', 'graphql'])
    .describe('"rest" to call a REST endpoint, "graphql" to send a GraphQL query'),

  // REST fields
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
    .optional()
    .describe('(REST only) HTTP method'),
  path: z
    .string()
    .optional()
    .describe('(REST only) Path relative to the API base, e.g. "/api/auth/login"'),
  body: z
    .string()
    .optional()
    .describe('(REST only) JSON-encoded request body string (for POST/PUT/PATCH)'),
  queryParams: z
    .string()
    .optional()
    .describe('(REST only) JSON-encoded query-string parameters object, e.g. \'{"page":"1"}\''),

  // GraphQL fields
  query: z
    .string()
    .optional()
    .describe('(GraphQL only) Full GraphQL query string'),
  variables: z
    .string()
    .optional()
    .describe('(GraphQL only) JSON-encoded variables object'),

  // Common
  headers: z
    .string()
    .optional()
    .describe('JSON-encoded headers object, e.g. \'{"Authorization":"Bearer <token>"}\''),
});

export type ExecuteInput = z.infer<typeof executeInputSchema>;

function parseJsonField(raw: string | undefined, fieldName: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new TypeError(`${fieldName} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    throw new Error(`Invalid JSON in "${fieldName}": ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function runExecute(input: ExecuteInput, baseUrl: string): Promise<string> {
  if (input.type === 'rest') {
    if (!input.method) throw new Error('"method" is required for REST requests');
    if (!input.path) throw new Error('"path" is required for REST requests');
    return executeRest(input as Required<Pick<ExecuteInput, 'method' | 'path'>> & ExecuteInput, baseUrl);
  }
  if (!input.query) throw new Error('"query" is required for GraphQL requests');
  return executeGraphql(input as Required<Pick<ExecuteInput, 'query'>> & ExecuteInput, baseUrl);
}

async function executeRest(
  input: Required<Pick<ExecuteInput, 'method' | 'path'>> & ExecuteInput,
  baseUrl: string,
): Promise<string> {
  const headers = parseJsonField(input.headers, 'headers');
  const queryParams = parseJsonField(input.queryParams, 'queryParams');

  const url = new URL(`${baseUrl}${input.path}`);
  for (const [k, v] of Object.entries(queryParams)) {
    url.searchParams.set(k, String(v));
  }

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)])),
  };

  const fetchOptions: RequestInit = {
    method: input.method,
    headers: fetchHeaders,
  };

  if (input.body && ['POST', 'PUT', 'PATCH'].includes(input.method)) {
    // Validate JSON before sending
    try {
      JSON.parse(input.body);
    } catch {
      throw new Error('body is not valid JSON');
    }
    fetchOptions.body = input.body;
  }

  const res = await fetch(url.toString(), fetchOptions);
  return formatResponse(res);
}

async function executeGraphql(
  input: Required<Pick<ExecuteInput, 'query'>> & ExecuteInput,
  baseUrl: string,
): Promise<string> {
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

async function formatResponse(res: Response): Promise<string> {
  const statusLine = `HTTP ${res.status} ${res.statusText}`;
  const contentType = res.headers.get('content-type') ?? '';

  let body: string;
  if (contentType.includes('application/json')) {
    try {
      const json = await res.json();
      body = JSON.stringify(json, null, 2);
    } catch {
      body = await res.text();
    }
  } else {
    body = await res.text();
  }

  const lines = [statusLine, ''];
  if (body) {
    lines.push(body);
  }

  return lines.join('\n');
}
