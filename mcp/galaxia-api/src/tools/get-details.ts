import { z } from 'zod';
import { fetchOpenApiDoc, getEndpointDetails } from '../lib/openapi.js';
import { getGqlQueryDetails, resolveSchemaPath } from '../lib/graphql-schema.js';

export const getDetailsInputSchema = z.object({
  id: z
    .string()
    .describe(
      'The ID returned by the `list` tool, e.g. "POST /api/auth/login" for REST or "query:products" for GraphQL.',
    ),
});

export type GetDetailsInput = z.infer<typeof getDetailsInputSchema>;

export async function runGetDetails(input: GetDetailsInput, baseUrl: string): Promise<string> {
  const { id } = input;

  if (id.startsWith('query:')) {
    return getGqlDetails(id.slice('query:'.length));
  }

  return getRestDetails(id, baseUrl);
}

async function getRestDetails(id: string, baseUrl: string): Promise<string> {
  const doc = await fetchOpenApiDoc(baseUrl);
  const details = getEndpointDetails(doc, id);

  if (!details) {
    return `No REST endpoint found with id "${id}". Use the \`list\` tool to see available endpoints.`;
  }

  const lines: string[] = [];
  lines.push(`## ${details.id}`);
  lines.push('');
  lines.push(`**Summary:** ${details.summary}`);
  if (details.description) lines.push(`**Description:** ${details.description}`);
  lines.push(`**Auth required:** ${details.requiresAuth ? 'Yes — include `Authorization: Bearer <accessToken>` header' : 'No'}`);
  lines.push('');

  if (details.parameters.length > 0) {
    lines.push('### Path / Query Parameters');
    for (const p of details.parameters) {
      const req = p.required ? ' *(required)*' : ' *(optional)*';
      const desc = p.description ? ` — ${p.description}` : '';
      lines.push(`- \`${p.name}\` (${p.in})${req}${desc}`);
      if (p.schema && typeof p.schema === 'object') {
        lines.push(`  Schema: \`${JSON.stringify(p.schema)}\``);
      }
    }
    lines.push('');
  }

  if (details.requestBody) {
    lines.push('### Request Body');
    if (details.requestBody.description) {
      lines.push(details.requestBody.description);
    }
    lines.push(`Required: ${details.requestBody.required ? 'yes' : 'no'}`);
    for (const [contentType, media] of Object.entries(details.requestBody.content)) {
      lines.push(`Content-Type: \`${contentType}\``);
      if (media.schema) {
        lines.push('```json');
        lines.push(JSON.stringify(media.schema, null, 2));
        lines.push('```');
      }
    }
    lines.push('');
  }

  if (Object.keys(details.responses).length > 0) {
    lines.push('### Responses');
    for (const [status, resp] of Object.entries(details.responses)) {
      lines.push(`- **${status}**: ${resp.description ?? ''}`);
    }
  }

  return lines.join('\n');
}

function getGqlDetails(queryName: string): string {
  const schemaPath = resolveSchemaPath();
  const result = getGqlQueryDetails(schemaPath, queryName);

  if (!result) {
    return `No GraphQL query named "${queryName}" found in the schema. Use the \`list\` tool to see available queries.`;
  }

  const { query, returnTypeInfo } = result;
  const lines: string[] = [];

  lines.push(`## GraphQL Query: \`${query.name}\``);
  lines.push('');
  if (query.description) {
    lines.push(`**Description:** ${query.description}`);
    lines.push('');
  }

  lines.push('### Arguments');
  if (query.args.length === 0) {
    lines.push('None');
  } else {
    for (const arg of query.args) {
      lines.push(`- \`${arg}\``);
    }
  }
  lines.push('');

  lines.push(`### Return Type: \`${query.returnType}\``);
  if (returnTypeInfo) {
    lines.push('');
    if (returnTypeInfo.description) lines.push(returnTypeInfo.description);
    lines.push('');
    lines.push('**Fields:**');
    for (const f of returnTypeInfo.fields) {
      const desc = f.description ? ` — ${f.description}` : '';
      lines.push(`- \`${f.name}: ${f.type}\`${desc}`);
    }
  }
  lines.push('');

  lines.push('### Example Query');
  lines.push('```graphql');
  if (query.args.length > 0) {
    const argsStr = query.args.map((a) => `$${a.replace(/:.+/, ': String')}`).join(', ');
    const inputStr = query.args
      .map((a) => {
        const name = a.split(':')[0].trim();
        return `${name}: $${name}`;
      })
      .join(', ');
    lines.push(`query ${capitalize(query.name)}(${argsStr}) {`);
    lines.push(`  ${query.name}(${inputStr}) {`);
    lines.push(`    # add fields here`);
    lines.push(`  }`);
    lines.push(`}`);
  } else {
    lines.push(`query {`);
    lines.push(`  ${query.name} {`);
    lines.push(`    # add fields here`);
    lines.push(`  }`);
    lines.push(`}`);
  }
  lines.push('```');

  return lines.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
