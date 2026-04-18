import { z } from 'zod';
import { fetchOpenApiDoc, flattenEndpoints } from '../lib/openapi.js';
import { listGqlQueries, resolveSchemaPath } from '../lib/graphql-schema.js';

export const listInputSchema = z.object({
  filter: z
    .string()
    .optional()
    .describe(
      'Optional keyword to filter results (matches path, summary, tag, or query name)',
    ),
});

export type ListInput = z.infer<typeof listInputSchema>;

export async function runList(input: ListInput, baseUrl: string): Promise<string> {
  const [doc, schemaPath] = await Promise.all([
    fetchOpenApiDoc(baseUrl),
    Promise.resolve(resolveSchemaPath()),
  ]);

  const endpoints = flattenEndpoints(doc);
  const gqlQueries = listGqlQueries(schemaPath);

  const kw = input.filter?.toLowerCase();

  const filteredEndpoints = kw
    ? endpoints.filter(
        (e) =>
          e.path.toLowerCase().includes(kw) ||
          e.summary.toLowerCase().includes(kw) ||
          e.tags.some((t) => t.toLowerCase().includes(kw)),
      )
    : endpoints;

  const filteredQueries = kw
    ? gqlQueries.filter(
        (q) =>
          q.name.toLowerCase().includes(kw) ||
          (q.description ?? '').toLowerCase().includes(kw),
      )
    : gqlQueries;

  const lines: string[] = [];

  lines.push('## REST Endpoints');
  lines.push('');
  lines.push('Use `get_details` with the `id` field to see full parameter/body schema.');
  lines.push('Use `execute` with type "rest" to call an endpoint.');
  lines.push('');

  if (filteredEndpoints.length === 0) {
    lines.push('(no endpoints match the filter)');
  } else {
    // Group by tag
    const byTag = new Map<string, typeof filteredEndpoints>();
    for (const ep of filteredEndpoints) {
      const tag = ep.tags[0] ?? 'other';
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(ep);
    }

    for (const [tag, eps] of byTag) {
      lines.push(`### ${tag}`);
      for (const ep of eps) {
        const auth = ep.requiresAuth ? ' 🔒' : '';
        lines.push(`- **${ep.id}**${auth} — ${ep.summary}`);
      }
      lines.push('');
    }
  }

  lines.push('## GraphQL Queries');
  lines.push('');
  lines.push('Endpoint: POST /graphql  (send `{ "query": "...", "variables": {} }`)');
  lines.push('Use `get_details` with the `id` field to see argument and return-type details.');
  lines.push('Use `execute` with type "graphql" to run a query.');
  lines.push('');

  if (filteredQueries.length === 0) {
    lines.push('(no queries match the filter)');
  } else {
    for (const q of filteredQueries) {
      const args = q.args.length ? `(${q.args.join(', ')})` : '()';
      const desc = q.description ? ` — ${q.description}` : '';
      lines.push(`- **${q.id}** \`${q.name}${args}: ${q.returnType}\`${desc}`);
    }
  }

  return lines.join('\n');
}
