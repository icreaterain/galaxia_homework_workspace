export interface GqlQueryInfo {
    /** Stable ID used in get_details / execute, e.g. "query:products" */
    id: string;
    name: string;
    description: string | null;
    args: string[];
    returnType: string;
}
export interface GqlTypeInfo {
    name: string;
    description: string | null;
    fields: Array<{
        name: string;
        type: string;
        description: string | null;
    }>;
}
export declare function listGqlQueries(schemaPath: string): GqlQueryInfo[];
export declare function getGqlQueryDetails(schemaPath: string, queryName: string): {
    query: GqlQueryInfo;
    returnTypeInfo: GqlTypeInfo | null;
} | null;
export declare function resolveSchemaPath(): string;
//# sourceMappingURL=graphql-schema.d.ts.map