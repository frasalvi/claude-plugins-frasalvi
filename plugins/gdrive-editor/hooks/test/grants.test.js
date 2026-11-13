/**
 * Review tier: plumbing
 *
 * Tests for the gdrive grant store and link parsing.
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
 * Point GDRIVE_GRANT_DIR at a fresh temp dir.
 *
 * Returns:
 *   The temp dir path.
 */
function freshDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdrive-grants-'));
  process.env.GDRIVE_GRANT_DIR = dir;
  return dir;
}

test('grantDir reads the env var at call time, with a home default', () => {
  const dir = freshDir();
  assert.strictEqual(grants.grantDir(), dir);
  delete process.env.GDRIVE_GRANT_DIR;
  assert.strictEqual(grants.grantDir(), path.join(os.homedir(), '.claude', 'gdrive-grants'));
  assert.ok(grants.grantDir().endsWith(path.join('.claude', 'gdrive-grants')));
});

test('isSafeSessionId accepts only simple ids', () => {
  assert.strictEqual(grants.isSafeSessionId('abc-123_X'), true);
  for (const bad of ['', '../x', 'a/b', 'a\\b', 'a.b', undefined, null, 5]) {
    assert.strictEqual(grants.isSafeSessionId(bad), false, String(bad));
  }
});

test('parseTrigger', () => {
  assert.strictEqual(grants.parseTrigger('/gdrive-editor:grant x'), 'x');
  assert.strictEqual(grants.parseTrigger('  gdrive: a b'), 'a b');
  assert.strictEqual(grants.parseTrigger('gdocs: a'), 'a');
  assert.strictEqual(grants.parseTrigger('/gdrive-editor:grant'), '');
  for (const p of ['/gdocs-editor:gdocs x', '/gdocs x', 'please gdrive: x', '/gdrive-editor:grantx y']) {
    assert.strictEqual(grants.parseTrigger(p), null, p);
  }
});

const doc = (id) => ({ id, kind: 'doc' });
const sheet = (id) => ({ id, kind: 'spreadsheet' });
const deck = (id) => ({ id, kind: 'presentation' });
const unknown = (id) => ({ id, kind: 'unknown' });

test('extractFileIds handles doc link variants, dedupe and bare tokens', () => {
  const text =
    `https://docs.google.com/document/d/${A}/edit?usp=sharing ` +
    `https://docs.google.com/document/u/1/d/${B}/edit#heading=h.x ` +
    `https://docs.google.com/document/d/${A}/edit`;
  assert.deepStrictEqual(grants.extractFileIds(text), [doc(A), doc(B)]);
  assert.deepStrictEqual(grants.extractFileIds(`  ${C} `), [unknown(C)]);
});

test('extractFileIds gives each link its kind, first occurrence winning', () => {
  const text =
    `gdrive: https://docs.google.com/document/d/${A}/edit ` +
    `https://docs.google.com/spreadsheets/u/0/d/${B}/edit#gid=0 ` +
    `https://docs.google.com/spreadsheets/d/${B}/edit?gid=123#gid=123 ` +
    `${C} please`;
  assert.deepStrictEqual(grants.extractFileIds(text), [doc(A), sheet(B), unknown(C)]);
});

test('extractFileIds recognizes presentation links', () => {
  const text =
    `https://docs.google.com/presentation/d/${A}/edit#slide=id.p ` +
    `https://docs.google.com/presentation/u/2/d/${B}/edit?usp=sharing`;
  assert.deepStrictEqual(grants.extractFileIds(text), [deck(A), deck(B)]);
  assert.deepStrictEqual(grants.extractFileIds('https://docs.google.com/presentation/d/e/2PACX-1vQabc/pub'), []);
});

test('extractFileIds rejects short words, short link ids, published links and other sites', () => {
  assert.deepStrictEqual(grants.extractFileIds('shortword'), []);
  assert.deepStrictEqual(grants.extractFileIds('https://docs.google.com/document/d/abcdefghij/edit'), []);
  assert.deepStrictEqual(
    grants.extractFileIds('https://docs.google.com/spreadsheets/d/e/2PACX-1vQabc/pubhtml'),
    [],
  );
  assert.deepStrictEqual(grants.extractFileIds(`https://example.com/${'x'.repeat(40)}`), []);
});

test('extractFileIds and normalizeFileId handle the real link form', () => {
  const link = `https://docs.google.com/document/d/${REAL}/edit?tab=t.0`;
  assert.deepStrictEqual(grants.extractFileIds(link), [doc(REAL)]);
  assert.strictEqual(grants.normalizeFileId(link), REAL);
});

test('normalizeFileId', () => {
  assert.strictEqual(grants.normalizeFileId(`https://docs.google.com/document/d/${A}/edit`), A);
  assert.strictEqual(grants.normalizeFileId(`https://docs.google.com/spreadsheets/d/${B}/edit#gid=0`), B);
  assert.strictEqual(grants.normalizeFileId(`https://docs.google.com/presentation/d/${C}/edit#slide=id.p`), C);
  assert.strictEqual(grants.normalizeFileId(A), A);
  assert.strictEqual(grants.normalizeFileId('short'), null);
  assert.strictEqual(grants.normalizeFileId(null), null);
  assert.strictEqual(grants.normalizeFileId(42), null);
});

test('addGrants merges and readGrants returns them', () => {
  freshDir();
  assert.deepStrictEqual(grants.addGrants('s1', [A]), [A]);
  assert.deepStrictEqual(grants.addGrants('s1', [B, A]), [A, B]);
  assert.deepStrictEqual(grants.readGrants('s1'), [A, B]);
  assert.deepStrictEqual(grants.readGrants('other'), []);
});

test('grant files hold a files list; a docs-only file reads as empty', () => {
  const dir = freshDir();
  grants.addGrants('s1', [A]);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 's1.json'), 'utf8')), { files: [A] });
  fs.writeFileSync(path.join(dir, 's2.json'), JSON.stringify({ docs: [A] }));
  assert.deepStrictEqual(grants.readGrants('s2'), []);
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
  process.env.GDRIVE_GRANT_DIR = path.join(os.tmpdir(), 'gdrive-does-not-exist-xyz');
  assert.deepStrictEqual(grants.pruneGrants(30), []);
});
