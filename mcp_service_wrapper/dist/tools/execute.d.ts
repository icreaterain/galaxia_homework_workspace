import { z } from 'zod';
/**
 * Flat schema accepted by McpServer.tool() — the discriminated logic is applied at runtime.
 * For REST: provide type="rest", method, path, and optionally body/headers/queryParams.
 * For GraphQL: provide type="graphql", query, and optionally variables/headers.
 */
export declare const executeInputSchema: z.ZodObject<{
    type: z.ZodEnum<["rest", "graphql"]>;
    method: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>>;
    path: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    queryParams: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
    variables: z.ZodOptional<z.ZodString>;
    headers: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "rest" | "graphql";
    path?: string | undefined;
    query?: string | undefined;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined;
    body?: string | undefined;
    queryParams?: string | undefined;
    variables?: string | undefined;
    headers?: string | undefined;
}, {
    type: "rest" | "graphql";
    path?: string | undefined;
    query?: string | undefined;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined;
    body?: string | undefined;
    queryParams?: string | undefined;
    variables?: string | undefined;
    headers?: string | undefined;
}>;
export type ExecuteInput = z.infer<typeof executeInputSchema>;
export declare function runExecute(input: ExecuteInput, baseUrl: string): Promise<string>;
//# sourceMappingURL=execute.d.ts.map