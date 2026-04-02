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
    responses?: Record<string, {
        description?: string;
    }>;
    security?: Array<Record<string, string[]>>;
}
export interface OpenApiDocument {
    openapi: string;
    info: {
        title: string;
        description?: string;
        version: string;
    };
    paths: Record<string, Record<string, OpenApiOperation>>;
    components?: {
        schemas?: Record<string, unknown>;
    };
}
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
    responses: Record<string, {
        description?: string;
    }>;
}
export declare function fetchOpenApiDoc(baseUrl: string): Promise<OpenApiDocument>;
export declare function flattenEndpoints(doc: OpenApiDocument): FlatEndpoint[];
export declare function getEndpointDetails(doc: OpenApiDocument, id: string): EndpointDetails | null;
//# sourceMappingURL=openapi.d.ts.map