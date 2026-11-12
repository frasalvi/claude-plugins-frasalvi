/**
 * Review tier: plumbing
 *
 * Tests for the gdrive-editor hook entry points and hooks.json wiring.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOKS = path.join(__dirname, '..');
const A = '1qFpuCbnDk5ydaFHVohmDGcD9oAIuR_Jk1GaqnFghaFg';
const LINK = `https://docs.google.com/document/d/${A}/edit?tab=t.0`;
const S = 'S'.repeat(44);

/**
 * Create a fresh temp grant directory.
 *
 * Returns:
 *   The directory path.
 */
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gdrive-entries-'));
}

/**
 * Run a hook script with stdin and a grant dir.
 *
 * Args:
 *   script: Script file name under hooks/.
 *   stdin: Raw stdin text.
 *   dir: Value for GDRIVE_GRANT_DIR.
 *
 * Returns:
 *   The spawnSync result.
 */
function run(script, stdin, dir) {
  return spawnSync(process.execPath, [path.join(HOOKS, script)], {
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, GDRIVE_GRANT_DIR: dir },
  });
}

/**
 * Load a Task 1 fixture as a hook input with a session id.
 *
 * Args:
 *   name: Fixture name without extension.
 *   sessionId: Session id to add.
 *
 * Returns:
 *   JSON string for stdin.
 */
function fixtureInput(name, sessionId) {
  const f = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', `${name}.json`), 'utf8'));
  return JSON.stringify({ ...f, session_id: sessionId });
}

test('grant.js records granted ids and reports them', () => {
  const dir = tmpDir();
  const r = run('grant.js', JSON.stringify({ session_id: 's1', prompt: `/gdrive-editor:grant ${LINK} please fix the intro` }), dir);
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 's1.json'), 'utf8')), { files: [A] });
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.strictEqual(out.hookEventName, 'UserPromptSubmit');
  assert.ok(out.additionalContext.includes(A));
});

test('grant.js grants a doc and a spreadsheet and names their kinds', () => {
  const dir = tmpDir();
  const sheet = `https://docs.google.com/spreadsheets/d/${S}/edit#gid=0`;
  const r = run('grant.js', JSON.stringify({ session_id: 's1', prompt: `gdrive: ${LINK} ${sheet}` }), dir);
  const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  assert.strictEqual(ctx, `Files granted to this session: ${A} (doc), ${S} (spreadsheet).`);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 's1.json'), 'utf8')), { files: [A, S] });
});

test('grant.js ignores a prompt that is not a trigger', () => {
  const dir = tmpDir();
  const r = run('grant.js', JSON.stringify({ session_id: 's1', prompt: `look at ${LINK}` }), dir);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  assert.deepStrictEqual(fs.readdirSync(dir), []);
});

test('grant.js grants only for source user or absent', () => {
  for (const source of ['system', 'sdk', 'loop_wakeup', 'schedule_wakeup', 'poll_event', 'weird', null]) {
    const dir = tmpDir();
    const r = run('grant.js', JSON.stringify({ session_id: 's1', source, prompt: `/gdrive-editor:grant ${LINK}` }), dir);
    assert.strictEqual(r.status, 0, String(source));
    assert.strictEqual(r.stdout, '', String(source));
    assert.deepStrictEqual(fs.readdirSync(dir), [], String(source));
  }
  const dir = tmpDir();
  const r = run('grant.js', JSON.stringify({ session_id: 's1', source: 'user', prompt: `/gdrive-editor:grant ${LINK}` }), dir);
  assert.ok(r.stdout.includes(A));
  assert.deepStrictEqual(fs.readdirSync(dir), ['s1.json']);
});

test('grant.js with a bare grant command says no link was recognized', () => {
  const dir = tmpDir();
  const r = run('grant.js', JSON.stringify({ session_id: 's1', prompt: '/gdrive-editor:grant' }), dir);
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(fs.readdirSync(dir), []);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /^No Google Docs or Sheets link was recognized in the grant prompt; nothing was granted\.$/);
});

test('grant.js exits 0 silently on bad stdin', () => {
  const r = run('grant.js', 'not json', tmpDir());
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
});

test('gate.js allows a granted doc silently and denies an ungranted session', () => {
  const dir = tmpDir();
  run('grant.js', JSON.stringify({ session_id: 's1', prompt: `/gdrive-editor:grant ${LINK}` }), dir);
  const ok = run('gate.js', fixtureInput('read_doc', 's1'), dir);
  assert.strictEqual(ok.status, 0);
  assert.strictEqual(ok.stdout, '');
  const no = run('gate.js', fixtureInput('read_doc', 's2'), dir);
  assert.strictEqual(no.status, 0);
  const out = JSON.parse(no.stdout).hookSpecificOutput;
  assert.strictEqual(out.hookEventName, 'PreToolUse');
  assert.strictEqual(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /\/gdrive-editor:grant/);
});

test('gate.js denies a hostile session id on a Docs call', () => {
  const r = run('gate.js', fixtureInput('read_doc', '../x'), tmpDir());
  assert.strictEqual(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('gate.js is silent for unrelated tools', () => {
  const r = run('gate.js', JSON.stringify({ session_id: 's1', tool_name: 'Bash', tool_input: { command: 'ls' } }), tmpDir());
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
});

test('gate.js denies malformed stdin only when it mentions Google', () => {
  const dir = tmpDir();
  const bad = run('gate.js', 'not json mcp__claude_ai_Google_Docs__read_doc', dir);
  assert.strictEqual(bad.status, 0);
  const out = JSON.parse(bad.stdout).hookSpecificOutput;
  assert.strictEqual(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /^gdrive gatekeeper error: /);

  const other = run('gate.js', 'not json', dir);
  assert.strictEqual(other.status, 0);
  assert.strictEqual(other.stdout, '');

  const sheets = run('gate.js', '{"tool_name":"mcp__claude_ai_Google_Sheets__get_values",', dir);
  assert.strictEqual(JSON.parse(sheets.stdout).hookSpecificOutput.permissionDecision, 'deny');

  const empty = run('gate.js', '', dir);
  assert.strictEqual(empty.status, 0);
  assert.strictEqual(empty.stdout, '');
});

test('session-start.js prunes old grants and never fails', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'old.json');
  fs.writeFileSync(file, '{"docs":[]}');
  const old = new Date(Date.now() - 40 * 86400000);
  fs.utimesSync(file, old, old);
  const r = run('session-start.js', '{}', dir);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  assert.strictEqual(fs.existsSync(file), false);
});

test('hooks.json is valid and points at existing scripts', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(HOOKS, 'hooks.json'), 'utf8'));
  const cmds = [];
  for (const groups of Object.values(cfg.hooks)) {
    for (const g of groups) for (const h of g.hooks) cmds.push(h);
  }
  assert.strictEqual(cmds.length, 4);
  for (const h of cmds) {
    const m = /^(?:command -v node >\/dev\/null 2>&1 \|\| exit 0; )?node "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/([\w-]+\.js)"$/.exec(h.command);
    assert.ok(m, h.command);
    assert.ok(fs.existsSync(path.join(HOOKS, m[1])), m[1]);
  }
  const [mcp, files] = cfg.hooks.PreToolUse;
  assert.strictEqual(mcp.matcher, 'mcp__.*');
  assert.strictEqual(mcp.hooks[0].command, 'node "${CLAUDE_PLUGIN_ROOT}/hooks/gate.js"');
  assert.strictEqual(files.matcher, '^Edit$|^Write$|^NotebookEdit$|^Bash$|^PowerShell$');
  assert.match(files.hooks[0].command, /^command -v node /);
  for (const pre of [mcp, files]) {
    assert.strictEqual(pre.hooks[0].timeout, 10);
    assert.strictEqual(pre.hooks[0].onFailure, 'block');
  }
  assert.ok(cfg.hooks.UserPromptSubmit && cfg.hooks.SessionStart);
});

test('the file-write gate passes when node is missing and still gates when present', { skip: process.platform === 'win32' }, () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(HOOKS, 'hooks.json'), 'utf8'));
  const cmd = cfg.hooks.PreToolUse[1].hooks[0].command;
  const root = path.join(HOOKS, '..');
  const dir = tmpDir();
  const write = JSON.stringify({ session_id: 's1', tool_name: 'Write', tool_input: { file_path: path.join(dir, 's1.json') } });
  const sh = (pathVar) => spawnSync('/bin/sh', ['-c', cmd], {
    input: write,
    encoding: 'utf8',
    env: { PATH: pathVar, CLAUDE_PLUGIN_ROOT: root, GDRIVE_GRANT_DIR: dir },
  });

  const missing = sh(tmpDir());
  assert.strictEqual(missing.status, 0);
  assert.strictEqual(missing.stdout, '');

  const present = sh(path.dirname(process.execPath));
  assert.strictEqual(present.status, 0);
  assert.strictEqual(JSON.parse(present.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('gate.js allows a granted spreadsheet silently and denies an ungranted session', () => {
  const dir = tmpDir();
  const sheet = 'https://docs.google.com/spreadsheets/d/1uZYbz9ZhWlqgxrrGkMAOkT0-xI203wCzku6FXav4470/edit';
  run('grant.js', JSON.stringify({ session_id: 's1', prompt: `gdrive: ${sheet}` }), dir);
  const ok = run('gate.js', fixtureInput('sheets_update_values', 's1'), dir);
  assert.strictEqual(ok.status, 0);
  assert.strictEqual(ok.stdout, '');
  const no = run('gate.js', fixtureInput('sheets_update_values', 's2'), dir);
  assert.strictEqual(JSON.parse(no.stdout).hookSpecificOutput.permissionDecision, 'deny');
});
