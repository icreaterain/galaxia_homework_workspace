import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

export const queryInputSchema = z.object({
  sql: z.string().min(1).describe('A read-only SQL SELECT statement to execute against the database'),
});

export type QueryInput = z.infer<typeof queryInputSchema>;

/**
 * Keywords that are always allowed as the first keyword of a statement,
 * regardless of what follows.
 */
const READ_FIRST_KEYWORDS = new Set([
  'SELECT',
  'WITH',
  'TABLE',
  'EXPLAIN',
  'SHOW',
  'VALUES',
]);

/**
 * Keywords that indicate a write or DDL/DCL operation.
 * Checked across the full (comment-stripped) SQL so that tricks like
 *   WITH x AS (DELETE ...) SELECT ...
 * are still caught.
 */
const WRITE_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'MERGE',
  'UPSERT',
  'DROP',
  'CREATE',
  'ALTER',
  'TRUNCATE',
  'RENAME',
  'GRANT',
  'REVOKE',
  'CALL',
  'EXECUTE',
  'EXEC',
  'DO',
  'COPY',
  'VACUUM',
  'ANALYZE',
  'REINDEX',
  'CLUSTER',
  'LOCK',
  'SET',
  'RESET',
  'IMPORT',
  'LOAD',
];

function stripComments(sql: string): string {
  // Remove /* ... */ block comments
  let s = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Remove -- line comments
  s = s.replace(/--[^\r\n]*/g, ' ');
  return s;
}

export function assertReadOnly(sql: string): void {
  const clean = stripComments(sql).trim();

  if (clean.length === 0) {
    throw new Error('Empty query.');
  }

  // Extract the first keyword of the whole statement
  const firstKeyword = clean.split(/\s+/)[0]?.toUpperCase() ?? '';
  if (!READ_FIRST_KEYWORDS.has(firstKeyword)) {
    throw new Error(
      `Only read-only queries are allowed. Statement starts with "${firstKeyword}" which is not permitted.`,
    );
  }

  // Scan the full statement for write/DDL keywords as whole words.
  // This catches CTE-wrapped mutations like: WITH x AS (DELETE ...) SELECT ...
  const upperSql = clean.toUpperCase();
  for (const kw of WRITE_KEYWORDS) {
    // Match the keyword as a whole word (surrounded by non-alphanumeric chars)
    const pattern = new RegExp(`(?<![A-Z0-9_])${kw}(?![A-Z0-9_])`);
    if (pattern.test(upperSql)) {
      throw new Error(
        `Query contains forbidden keyword "${kw}". Only read-only queries are allowed.`,
      );
    }
  }
}

function formatResults(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return JSON.stringify({ rowCount: 0, rows: [] }, null, 2);
  }

  const MAX_ROWS = 500;
  const displayed = rows.slice(0, MAX_ROWS);

  // Serialize Decimal / Date / Buffer values that JSON.stringify would lose
  const serialized = displayed.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) {
        out[k] = null;
      } else if (typeof v === 'bigint') {
        out[k] = v.toString();
      } else if (v instanceof Date) {
        out[k] = v.toISOString();
      } else if (Buffer.isBuffer(v)) {
        out[k] = v.toString('hex');
      } else if (typeof (v as { toFixed?: unknown }).toFixed === 'function') {
        // Prisma Decimal
        out[k] = (v as { toString(): string }).toString();
      } else {
        out[k] = v;
      }
    }
    return out;
  });

  const result: Record<string, unknown> = {
    rowCount: rows.length,
    rows: serialized,
  };

  if (rows.length > MAX_ROWS) {
    result['note'] = `Showing first ${MAX_ROWS} of ${rows.length} rows. Add LIMIT/OFFSET to paginate.`;
  }

  return JSON.stringify(result, null, 2);
}

export async function runQuery(
  input: QueryInput,
  prisma: PrismaClient,
): Promise<string> {
  assertReadOnly(input.sql);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(input.sql);

  return formatResults(rows);
}
