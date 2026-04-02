"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGqlQueries = listGqlQueries;
exports.getGqlQueryDetails = getGqlQueryDetails;
exports.resolveSchemaPath = resolveSchemaPath;
const graphql_1 = require("graphql");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let cachedSchema = null;
function loadSchema(schemaPath) {
    if (cachedSchema)
        return cachedSchema;
    const sdl = fs_1.default.readFileSync(schemaPath, 'utf-8');
    cachedSchema = (0, graphql_1.buildSchema)(sdl);
    return cachedSchema;
}
function typeToString(type) {
    if (type instanceof graphql_1.GraphQLNonNull) {
        return `${typeToString(type.ofType)}!`;
    }
    if (type instanceof graphql_1.GraphQLList) {
        return `[${typeToString(type.ofType)}]`;
    }
    if (type && typeof type === 'object' && 'name' in type) {
        return type.name;
    }
    return String(type);
}
function listGqlQueries(schemaPath) {
    const schema = loadSchema(schemaPath);
    const queryType = schema.getQueryType();
    if (!queryType)
        return [];
    return Object.values(queryType.getFields()).map((field) => ({
        id: `query:${field.name}`,
        name: field.name,
        description: field.description ?? null,
        args: field.args.map((a) => `${a.name}: ${typeToString(a.type)}`),
        returnType: typeToString(field.type),
    }));
}
function getGqlQueryDetails(schemaPath, queryName) {
    const schema = loadSchema(schemaPath);
    const queryType = schema.getQueryType();
    if (!queryType)
        return null;
    const field = queryType.getFields()[queryName];
    if (!field)
        return null;
    const queryInfo = {
        id: `query:${field.name}`,
        name: field.name,
        description: field.description ?? null,
        args: field.args.map((a) => `${a.name}: ${typeToString(a.type)}`),
        returnType: typeToString(field.type),
    };
    // Unwrap NonNull/List to get the named type
    let namedType = field.type;
    while (namedType instanceof graphql_1.GraphQLNonNull || namedType instanceof graphql_1.GraphQLList) {
        namedType = namedType.ofType;
    }
    let returnTypeInfo = null;
    if (namedType instanceof graphql_1.GraphQLObjectType) {
        returnTypeInfo = {
            name: namedType.name,
            description: namedType.description ?? null,
            fields: Object.values(namedType.getFields()).map((f) => ({
                name: f.name,
                type: typeToString(f.type),
                description: f.description ?? null,
            })),
        };
    }
    return { query: queryInfo, returnTypeInfo };
}
function resolveSchemaPath() {
    // Walk up from the MCP package to find schema.graphql in the BE submodule
    const candidates = [
        path_1.default.resolve(__dirname, '../../cloudtalk_homework_be/schema.graphql'),
        path_1.default.resolve(__dirname, '../../../cloudtalk_homework_be/schema.graphql'),
        path_1.default.resolve(process.cwd(), '../cloudtalk_homework_be/schema.graphql'),
        path_1.default.resolve(process.cwd(), 'cloudtalk_homework_be/schema.graphql'),
    ];
    const envPath = process.env['SCHEMA_PATH'];
    if (envPath)
        candidates.unshift(envPath);
    for (const candidate of candidates) {
        if (fs_1.default.existsSync(candidate))
            return candidate;
    }
    throw new Error(`Could not find schema.graphql. Set SCHEMA_PATH env var or ensure cloudtalk_homework_be is a sibling directory. Tried:\n${candidates.join('\n')}`);
}
//# sourceMappingURL=graphql-schema.js.map