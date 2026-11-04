/**
 * Review tier: plumbing
 *
 * Tests for the gdocs grant store and link parsing.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const grants = require('../lib/grants');

const A = 'A'.repeat(28);
const B = 'B'.repeat(28);
const C = 'C'.repeat(28);
const REAL = '1qFpuCbnDk5ydaFHVohmDGcD9oAIuR_Jk1GaqnFghaFg';

/**
 * Point GDOCS_GRANT_DIR at a fresh temp dir.
 *
 * Returns:
 *   The temp dir path.
 */
function freshDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdocs-grants-'));
  process.env.GDOCS_GRANT_DIR = dir;
  return dir;
}

test('grantDir reads the env var at call time, with a home default', () => {
  const dir = freshDir();
  assert.strictEqual(grants.grantDir(), dir);
  delete process.env.GDOCS_GRANT_DIR;
  assert.strictEqual(grants.grantDir(), path.join(os.homedir(), '.claude', 'gdocs-grants'));
});

test('isSafeSessionId accepts only simple ids', () => {
  assert.strictEqual(grants.isSafeSessionId('abc-123_X'), true);
  for (const bad of ['', '../x', 'a/b', 'a\\b', 'a.b', undefined, null, 5]) {
    assert.strictEqual(grants.isSafeSessionId(bad), false, String(bad));
  }
});

test('parseTrigger', () => {
  assert.strictEqual(grants.parseTrigger('/gdocs https://x'), 'https://x');
  assert.strictEqual(grants.parseTrigger('  gdocs: a b'), 'a b');
  assert.strictEqual(grants.parseTrigger('/gdocs-editor:gdocs x'), 'x');
  assert.strictEqual(grants.parseTrigger('/gdocs'), '');
  assert.strictEqual(grants.parseTrigger('please /gdocs x'), null);
  assert.strictEqual(grants.parseTrigger('/gdocsfoo x'), null);
});

test('extractDocIds handles link variants, dedupe and bare tokens', () => {
  const text =
    `https://docs.google.com/document/d/${A}/edit?usp=sharing ` +
    `https://docs.google.com/document/u/1/d/${B}/edit#heading=h.x ` +
    `https://docs.google.com/document/d/${A}/edit`;
  assert.deepStrictEqual(grants.extractDocIds(text), [A, B]);
  assert.deepStrictEqual(grants.extractDocIds(`  ${C} `), [C]);
});

test('extractDocIds rejects short words and non-Docs links', () => {
  assert.deepStrictEqual(grants.extractDocIds('shortword'), []);
  assert.deepStrictEqual(
    grants.extractDocIds(`https://docs.google.com/spreadsheets/d/${C}/edit`),
    [],
  );
  assert.deepStrictEqual(
    grants.extractDocIds(`https://example.com/${'x'.repeat(40)}`),
    [],
  );
});

test('extractDocIds and normalizeDocId handle the real link form', () => {
  const link = `https://docs.google.com/document/d/${REAL}/edit?tab=t.0`;
  assert.deepStrictEqual(grants.extractDocIds(link), [REAL]);
  assert.strictEqual(grants.normalizeDocId(link), REAL);
});

test('normalizeDocId', () => {
  assert.strictEqual(grants.normalizeDocId(`https://docs.google.com/document/d/${A}/edit`), A);
  assert.strictEqual(grants.normalizeDocId(A), A);
  assert.strictEqual(grants.normalizeDocId('short'), null);
  assert.strictEqual(grants.normalizeDocId(null), null);
  assert.strictEqual(grants.normalizeDocId(42), null);
});

test('addGrants merges and readGrants returns them', () => {
  freshDir();
  assert.deepStrictEqual(grants.addGrants('s1', [A]), [A]);
  assert.deepStrictEqual(grants.addGrants('s1', [B, A]), [A, B]);
  assert.deepStrictEqual(grants.readGrants('s1'), [A, B]);
  assert.deepStrictEqual(grants.readGrants('other'), []);
});

test('unsafe session ids create nothing', () => {
  const dir = freshDir();
  for (const id of ['', '../x', 'a/b', 'a\\b', undefined]) {
    assert.deepStrictEqual(grants.addGrants(id, [A]), []);
    assert.deepStrictEqual(grants.readGrants(id), []);
  }
  assert.deepStrictEqual(fs.readdirSync(dir), []);
  assert.strictEqual(fs.existsSync(path.join(dir, '..', 'x.json')), false);
});

test('readGrants tolerates a corrupt file', () => {
  const dir = freshDir();
  fs.writeFileSync(path.join(dir, 's1.json'), 'not json');
  assert.deepStrictEqual(grants.readGrants('s1'), []);
});

test('addGrants leaves no temp files behind', () => {
  const dir = freshDir();
  grants.addGrants('s1', [A]);
  assert.deepStrictEqual(fs.readdirSync(dir), ['s1.json']);
});

test('touchGrant updates mtime and ignores a missing file', () => {
  const dir = freshDir();
  grants.addGrants('s1', [A]);
  const file = path.join(dir, 's1.json');
  const old = new Date(Date.now() - 10 * 86400000);
  fs.utimesSync(file, old, old);
  grants.touchGrant('s1');
  assert.ok(Date.now() - fs.statSync(file).mtimeMs < 60000);
  assert.doesNotThrow(() => grants.touchGrant('missing'));
  assert.doesNotThrow(() => grants.touchGrant('../x'));
});

test('pruneGrants deletes only files older than the cutoff', () => {
  const dir = freshDir();
  const now = Date.now();
  const day = 86400000;
  grants.addGrants('old', [A]);
  grants.addGrants('new', [B]);
  const age = (id, days) => {
    const t = new Date(now - days * day);
    fs.utimesSync(path.join(dir, `${id}.json`), t, t);
  };
  age('old', 31);
  age('new', 29);
  assert.deepStrictEqual(grants.pruneGrants(30, now), ['old']);
  assert.deepStrictEqual(fs.readdirSync(dir), ['new.json']);
});

test('pruneGrants on a missing dir returns []', () => {
  process.env.GDOCS_GRANT_DIR = path.join(os.tmpdir(), 'gdocs-does-not-exist-xyz');
  assert.deepStrictEqual(grants.pruneGrants(30), []);
});
