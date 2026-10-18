#!/usr/bin/env node
/**
 * Checks your current Galaxia task on this machine and reports the result.
 *
 *   node scripts/galaxia-verify.mjs
 *
 * Asks Galaxia for the checks of the task you are working on, runs them from
 * the root of this workspace — the same commands the ticket's acceptance
 * criteria name — and sends back what happened. When every check passes, the
 * task counts as done. Uses the same GALAXIA_API_URL and GALAXIA_HOOK_TOKEN as
 * the Claude Code hook (your Galaxia profile shows both).
 *
 * TEMPORARY (development only): Galaxia takes the results this script reports
 * as they are, so a result could be forged. Accepted while the course is in
 * development; must be replaced for production by a result the server can
 * verify.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_URL = (process.env.GALAXIA_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const HOOK_TOKEN = process.env.GALAXIA_HOOK_TOKEN || '';
const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_TIMEOUT_MS = Number(process.env.GALAXIA_CHECK_TIMEOUT_MS || 10 * 60 * 1000);
const OUTPUT_TAIL_CHARS = 4000;

async function api(path, init = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${HOOK_TOKEN}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function runShell(cmd) {
  return new Promise((resolveRun) => {
    let output = '';
    const child = spawn('sh', ['-c', cmd], { cwd: WORKSPACE_ROOT, env: process.env });
    const keep = (chunk) => {
      process.stdout.write(chunk);
      output = (output + chunk.toString()).slice(-OUTPUT_TAIL_CHARS);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => {
      output += `\n[galaxia-verify] timed out after ${CHECK_TIMEOUT_MS} ms`;
      child.kill('SIGKILL');
    }, CHECK_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveRun({ exitCode: code ?? 1, output });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolveRun({ exitCode: 1, output: `${output}\n${error.message}` });
    });
  });
}

async function runCheck(check) {
  const started = Date.now();
  const done = (passed, exitCode, output) => ({
    check_id: check.id,
    passed,
    exit_code: exitCode,
    output_tail: String(output || '').slice(-OUTPUT_TAIL_CHARS),
    duration_ms: Date.now() - started,
  });

  if (check.unsupported) {
    return done(false, null, `This version of galaxia-verify cannot run a "${check.unsupported}" check.`);
  }
  if (check.type === 'shell') {
    const { exitCode, output } = await runShell(check.cmd || 'false');
    return done(exitCode === 0, exitCode, output);
  }
  if (check.type === 'file_exists') {
    const found = Boolean(check.path) && existsSync(resolve(WORKSPACE_ROOT, check.path));
    return done(found, null, found ? `${check.path} exists` : `${check.path} not found`);
  }
  if (check.type === 'http_get') {
    try {
      const response = await fetch(check.url);
      const body = await response.text();
      const failed = (check.asserts || []).find((assertion) => {
        const selector = assertion.startsWith('dom_has ') ? assertion.slice('dom_has '.length).trim() : null;
        return !selector || !body.includes(selector);
      });
      const passed = response.ok && !failed;
      return done(passed, response.status, failed ? `assertion failed: ${failed}` : `HTTP ${response.status}`);
    } catch (error) {
      return done(false, null, error instanceof Error ? error.message : String(error));
    }
  }
  return done(false, null, `Unknown check type: ${check.type}`);
}

async function main() {
  if (!HOOK_TOKEN) {
    console.error('GALAXIA_HOOK_TOKEN is not set. Copy the export lines from your Galaxia profile into this terminal first.');
    return 2;
  }

  const active = await api('/api/agent-hooks/tasks/active');
  if (active.status !== 200) {
    console.error(`Galaxia: ${active.body.detail || `HTTP ${active.status}`}`);
    return 2;
  }
  const { task_id: taskId, title, checks } = active.body;
  console.log(`Checking "${title}" — ${checks.length} check(s) from ${WORKSPACE_ROOT}\n`);

  const results = [];
  for (const check of checks) {
    console.log(`▶ ${check.description || check.unsupported || check.type}`);
    const result = await runCheck(check);
    console.log(`${result.passed ? '✓ passed' : '✗ failed'}\n`);
    results.push(result);
  }

  const reported = await api(`/api/agent-hooks/tasks/${taskId}/verification`, {
    method: 'POST',
    body: JSON.stringify({ results }),
  });
  if (reported.status !== 200) {
    console.error(`Galaxia did not record the result: ${reported.body.detail || `HTTP ${reported.status}`}`);
    return 2;
  }
  if (reported.body.verification_state === 'passed') {
    console.log('All checks passed — the task counts as done. Head back to Galaxia.');
    return 0;
  }
  console.log('Some checks failed. Fix them and run this again; Galaxia has the output.');
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`galaxia-verify: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  },
);
