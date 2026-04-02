"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInputSchema = void 0;
exports.runList = runList;
const zod_1 = require("zod");
const openapi_js_1 = require("../lib/openapi.js");
const graphql_schema_js_1 = require("../lib/graphql-schema.js");
exports.listInputSchema = zod_1.z.object({
    filter: zod_1.z
        .string()
        .optional()
        .describe('Optional keyword to filter results (matches path, summary, tag, or query name)'),
});
async function runList(input, baseUrl) {
    const [doc, schemaPath] = await Promise.all([
        (0, openapi_js_1.fetchOpenApiDoc)(baseUrl),
        Promise.resolve((0, graphql_schema_js_1.resolveSchemaPath)()),
    ]);
    const endpoints = (0, openapi_js_1.flattenEndpoints)(doc);
    const gqlQueries = (0, graphql_schema_js_1.listGqlQueries)(schemaPath);
    const kw = input.filter?.toLowerCase();
    const filteredEndpoints = kw
        ? endpoints.filter((e) => e.path.toLowerCase().includes(kw) ||
            e.summary.toLowerCase().includes(kw) ||
            e.tags.some((t) => t.toLowerCase().includes(kw)))
        : endpoints;
    const filteredQueries = kw
        ? gqlQueries.filter((q) => q.name.toLowerCase().includes(kw) ||
            (q.description ?? '').toLowerCase().includes(kw))
        : gqlQueries;
    const lines = [];
    lines.push('## REST Endpoints');
    lines.push('');
    lines.push('Use `get_details` with the `id` field to see full parameter/body schema.');
    lines.push('Use `execute` with type "rest" to call an endpoint.');
    lines.push('');
    if (filteredEndpoints.length === 0) {
        lines.push('(no endpoints match the filter)');
    }
    else {
        // Group by tag
        const byTag = new Map();
        for (const ep of filteredEndpoints) {
            const tag = ep.tags[0] ?? 'other';
            if (!byTag.has(tag))
                byTag.set(tag, []);
            byTag.get(tag).push(ep);
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
    }
    else {
        for (const q of filteredQueries) {
            const args = q.args.length ? `(${q.args.join(', ')})` : '()';
            const desc = q.description ? ` — ${q.description}` : '';
            lines.push(`- **${q.id}** \`${q.name}${args}: ${q.returnType}\`${desc}`);
        }
    }
    return lines.join('\n');
}
//# sourceMappingURL=list.js.map