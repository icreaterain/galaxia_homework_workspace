/** Minimal OpenAPI 3.x types used by the MCP tools. */

export interface OpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: Record<string, unknown>;
}

export interface OpenApiMediaType {
  schema?: Record<string, unknown>;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    required?: boolean;
    description?: string;
    content: Record<string, OpenApiMediaType>;
  };
  responses?: Record<string, { description?: string }>;
  security?: Array<Record<string, string[]>>;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; description?: string; version: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    schemas?: Record<string, unknown>;
  };
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

export interface FlatEndpoint {
  /** Stable ID used in get_details / execute, e.g. "POST /api/auth/login" */
  id: string;
  method: string;
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  requiresAuth: boolean;
}

export interface EndpointDetails extends FlatEndpoint {
  parameters: OpenApiParameter[];
  requestBody: OpenApiOperation['requestBody'];
  responses: Record<string, { description?: string }>;
}

let cachedDoc: OpenApiDocument | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 30_000;

export async function fetchOpenApiDoc(baseUrl: string): Promise<OpenApiDocument> {
  const now = Date.now();
  if (cachedDoc && now - cacheTs < CACHE_TTL_MS) {
    return cachedDoc;
  }

  const res = await fetch(`${baseUrl}/docs-json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`);
  }
  const doc = (await res.json()) as OpenApiDocument;
  cachedDoc = doc;
  cacheTs = now;
  return doc;
}

export function flattenEndpoints(doc: OpenApiDocument): FlatEndpoint[] {
  const endpoints: FlatEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method as HttpMethod];
      if (!op) continue;

      const requiresAuth =
        Array.isArray(op.security) && op.security.length > 0
          ? op.security.some((s) => Object.keys(s).length > 0)
          : false;

      endpoints.push({
        id: `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        summary: op.summary ?? `${method.toUpperCase()} ${path}`,
        description: op.description,
        tags: op.tags ?? [],
        requiresAuth,
      });
    }
  }

  return endpoints;
}

export function getEndpointDetails(doc: OpenApiDocument, id: string): EndpointDetails | null {
  const spaceIdx = id.indexOf(' ');
  if (spaceIdx === -1) return null;

  const method = id.slice(0, spaceIdx).toLowerCase() as HttpMethod;
  const path = id.slice(spaceIdx + 1);

  const pathItem = doc.paths?.[path];
  if (!pathItem) return null;

  const op = pathItem[method];
  if (!op) return null;

  const requiresAuth =
    Array.isArray(op.security) && op.security.length > 0
      ? op.security.some((s) => Object.keys(s).length > 0)
      : false;

  return {
    id,
    method: method.toUpperCase(),
    path,
    summary: op.summary ?? id,
    description: op.description,
    tags: op.tags ?? [],
    requiresAuth,
    parameters: op.parameters ?? [],
    requestBody: op.requestBody,
    responses: op.responses ?? {},
  };
}
