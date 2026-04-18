import { buildSchema, GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLList } from 'graphql';
import fs from 'fs';
import path from 'path';

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
  fields: Array<{ name: string; type: string; description: string | null }>;
}

let cachedSchema: GraphQLSchema | null = null;

function loadSchema(schemaPath: string): GraphQLSchema {
  if (cachedSchema) return cachedSchema;
  const sdl = fs.readFileSync(schemaPath, 'utf-8');
  cachedSchema = buildSchema(sdl);
  return cachedSchema;
}

function typeToString(type: unknown): string {
  if (type instanceof GraphQLNonNull) {
    return `${typeToString(type.ofType)}!`;
  }
  if (type instanceof GraphQLList) {
    return `[${typeToString(type.ofType)}]`;
  }
  if (type && typeof type === 'object' && 'name' in type) {
    return (type as { name: string }).name;
  }
  return String(type);
}

export function listGqlQueries(schemaPath: string): GqlQueryInfo[] {
  const schema = loadSchema(schemaPath);
  const queryType = schema.getQueryType();
  if (!queryType) return [];

  return Object.values(queryType.getFields()).map((field) => ({
    id: `query:${field.name}`,
    name: field.name,
    description: field.description ?? null,
    args: field.args.map((a) => `${a.name}: ${typeToString(a.type)}`),
    returnType: typeToString(field.type),
  }));
}

export function getGqlQueryDetails(
  schemaPath: string,
  queryName: string,
): { query: GqlQueryInfo; returnTypeInfo: GqlTypeInfo | null } | null {
  const schema = loadSchema(schemaPath);
  const queryType = schema.getQueryType();
  if (!queryType) return null;

  const field = queryType.getFields()[queryName];
  if (!field) return null;

  const queryInfo: GqlQueryInfo = {
    id: `query:${field.name}`,
    name: field.name,
    description: field.description ?? null,
    args: field.args.map((a) => `${a.name}: ${typeToString(a.type)}`),
    returnType: typeToString(field.type),
  };

  // Unwrap NonNull/List to get the named type
  let namedType: unknown = field.type;
  while (namedType instanceof GraphQLNonNull || namedType instanceof GraphQLList) {
    namedType = (namedType as GraphQLNonNull<never> | GraphQLList<never>).ofType;
  }

  let returnTypeInfo: GqlTypeInfo | null = null;
  if (namedType instanceof GraphQLObjectType) {
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

export function resolveSchemaPath(): string {
  // Walk up from the MCP package to find schema.graphql in the BE submodule
  const candidates = [
    path.resolve(__dirname, '../../../../galaxia_homework_be/schema.graphql'),
    path.resolve(__dirname, '../../galaxia_homework_be/schema.graphql'),
    path.resolve(__dirname, '../../../galaxia_homework_be/schema.graphql'),
    path.resolve(process.cwd(), '../../galaxia_homework_be/schema.graphql'),
    path.resolve(process.cwd(), '../galaxia_homework_be/schema.graphql'),
    path.resolve(process.cwd(), 'galaxia_homework_be/schema.graphql'),
  ];

  const envPath = process.env['SCHEMA_PATH'];
  if (envPath) candidates.unshift(envPath);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    `Could not find schema.graphql. Set SCHEMA_PATH env var or ensure galaxia_homework_be is a sibling directory. Tried:\n${candidates.join('\n')}`,
  );
}
