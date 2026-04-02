"use strict";
/** Minimal OpenAPI 3.x types used by the MCP tools. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchOpenApiDoc = fetchOpenApiDoc;
exports.flattenEndpoints = flattenEndpoints;
exports.getEndpointDetails = getEndpointDetails;
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
let cachedDoc = null;
let cacheTs = 0;
const CACHE_TTL_MS = 30_000;
async function fetchOpenApiDoc(baseUrl) {
    const now = Date.now();
    if (cachedDoc && now - cacheTs < CACHE_TTL_MS) {
        return cachedDoc;
    }
    const res = await fetch(`${baseUrl}/docs-json`);
    if (!res.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`);
    }
    const doc = (await res.json());
    cachedDoc = doc;
    cacheTs = now;
    return doc;
}
function flattenEndpoints(doc) {
    const endpoints = [];
    for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
        for (const method of HTTP_METHODS) {
            const op = pathItem[method];
            if (!op)
                continue;
            const requiresAuth = Array.isArray(op.security) && op.security.length > 0
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
function getEndpointDetails(doc, id) {
    const spaceIdx = id.indexOf(' ');
    if (spaceIdx === -1)
        return null;
    const method = id.slice(0, spaceIdx).toLowerCase();
    const path = id.slice(spaceIdx + 1);
    const pathItem = doc.paths?.[path];
    if (!pathItem)
        return null;
    const op = pathItem[method];
    if (!op)
        return null;
    const requiresAuth = Array.isArray(op.security) && op.security.length > 0
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
//# sourceMappingURL=openapi.js.map