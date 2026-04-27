#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const API_URL = (process.env.GALAXIA_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const HOOK_TOKEN = process.env.GALAXIA_HOOK_TOKEN || '';
const STATE_PATH = resolve('.galaxia/claude-sync-state.json');

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf8'));
  } catch {
    return { transcripts: {} };
  }
}

async function writeState(state) {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2));
}

function textFromContent(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content.flatMap((part) => {
    if (!part || typeof part !== 'object') {
      return [];
    }
    if (typeof part.text === 'string') {
      return [part.text];
    }
    if (part.type === 'tool_use') {
      return [`[tool_use:${part.name || part.id || 'tool'}]`];
    }
    if (part.type === 'tool_result') {
      const resultText = typeof part.content === 'string' ? part.content : '';
      return [`[tool_result:${part.tool_use_id || 'tool'}] ${resultText}`.trim()];
    }
    return [];
  }).join('\n').trim();
}

function normalizeLine(line, index, sessionId) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  const message = parsed.message && typeof parsed.message === 'object' ? parsed.message : parsed;
  const role = typeof message.role === 'string'
    ? message.role
    : typeof parsed.type === 'string'
      ? parsed.type
      : 'unknown';
  const content = textFromContent(message.content ?? parsed.content);
  if (!content) {
    return null;
  }

  const sourceId = String(
    parsed.uuid ||
      parsed.id ||
      message.id ||
      `${sessionId}:${index}:${sha256(line).slice(0, 24)}`,
  );

  return {
    source_id: sourceId,
    role,
    type: parsed.type || 'message',
    content,
    occurred_at: parsed.timestamp || parsed.created_at || new Date().toISOString(),
    raw: parsed,
  };
}

async function readTranscriptDeltas(transcriptPath, sessionId, state) {
  const key = resolve(transcriptPath);
  const current = state.transcripts[key] || { line_count: 0 };
  const raw = await readFile(key, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const start = Math.min(Number(current.line_count || 0), lines.length);
  const newLines = lines.slice(start);
  const items = newLines
    .map((line, offset) => normalizeLine(line, start + offset + 1, sessionId))
    .filter(Boolean);

  state.transcripts[key] = {
    line_count: lines.length,
    updated_at: new Date().toISOString(),
  };

  return items;
}

async function main() {
  if (!HOOK_TOKEN) {
    console.error('[galaxia-sync] GALAXIA_HOOK_TOKEN is not set; skipping sync.');
    return;
  }

  const stdin = readStdin();
  const hookInput = stdin.trim() ? JSON.parse(stdin) : {};
  const transcriptPath = hookInput.transcript_path;
  if (!transcriptPath) {
    console.error('[galaxia-sync] transcript_path missing from Claude hook input; skipping sync.');
    return;
  }

  const sessionId = String(hookInput.session_id || sha256(resolve(transcriptPath)).slice(0, 32));
  const state = await readState();
  const items = await readTranscriptDeltas(transcriptPath, sessionId, state);

  const response = await fetch(`${API_URL}/api/agent-hooks/claude-code/events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HOOK_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: sessionId,
      cwd: hookInput.cwd || process.cwd(),
      hook_event_name: hookInput.hook_event_name || 'Stop',
      last_assistant_message: hookInput.last_assistant_message || null,
      items,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[galaxia-sync] backend rejected sync (${response.status}): ${body}`);
    return;
  }

  await writeState(state);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[galaxia-sync] sync failed:', error instanceof Error ? error.message : String(error));
    process.exit(0);
  });
