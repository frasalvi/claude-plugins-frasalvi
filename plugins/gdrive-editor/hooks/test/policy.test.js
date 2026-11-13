/**
 * Review tier: plumbing
 *
 * Tests for the gdrive gatekeeper policy.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { decide, classify } = require('../lib/policy');

const ID = '1qFpuCbnDk5ydaFHVohmDGcD9oAIuR_Jk1GaqnFghaFg';
const G = [ID];
const DIR = 'C:\\Users\\x\\.claude\\gdrive-grants';
const UPDATE = 'mcp__claude_ai_Google_Docs__update_doc';
const FIXTURES = path.join(__dirname, 'fixtures');

/**
 * Load a Task 1 fixture.
 *
 * Args:
 *   name: Fixture file name without extension.
 *
 * Returns:
 *   The parsed hook input.
 */
function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));
}

/**
 * Build an update_doc input.
 *
 * Args:
 *   requests: The requests array.
 *   writeControl: Optional writeControl object.
 *
 * Returns:
 *   A hook input object for the granted doc.
 */
function update(requests, writeControl) {
  const tool_input = { documentId: ID, requests };
  if (writeControl !== undefined) tool_input.writeControl = writeControl;
  return { tool_name: UPDATE, tool_input };
}

const SUGGEST = { writeMode: 'SUGGEST' };

for (const name of ['read_doc', 'update_doc_suggest', 'update_doc_comment', 'update_doc_mixed', 'update_doc_reply']) {
  test(`fixture ${name}: allow when granted, deny when not`, () => {
    const input = fixture(name);
    assert.strictEqual(decide(input, G, DIR).decision, 'allow');
    const denied = decide(input, [], DIR);
    assert.strictEqual(denied.decision, 'deny');
    assert.match(denied.reason, /^This file is not granted to this session\. Ask the lead to run `\/gdrive-editor:grant <link>` or send `gdrive: <link>`\.$/);
  });
}

test('read_doc with a full doc link is allowed', () => {
  const input = fixture('read_doc');
  input.tool_input.documentId = `https://docs.google.com/document/d/${ID}/edit?tab=t.0`;
  assert.strictEqual(decide(input, G, DIR).decision, 'allow');
});

test('missing documentId is denied', () => {
  const input = fixture('read_doc');
  delete input.tool_input.documentId;
  assert.strictEqual(decide(input, G, DIR).decision, 'deny');
});

test('writeMode must be exactly SUGGEST for edits', () => {
  const edit = [{ insertText: { text: 'x', location: { index: 1 } } }];
  assert.strictEqual(decide(update(edit), G, DIR).decision, 'deny');
  assert.strictEqual(decide(update(edit, {}), G, DIR).decision, 'deny');
  assert.strictEqual(decide(update(edit, { writeMode: 'suggest' }), G, DIR).decision, 'deny');
  assert.strictEqual(decide(update(edit, SUGGEST), G, DIR).decision, 'allow');
});

test('ops that cannot be suggestions are allowed without SUGGEST, alone or with comments', () => {
  for (const op of ['addDocumentTab', 'updateDocumentTabProperties', 'updateDocumentStyle', 'createNamedRange', 'deleteNamedRange']) {
    for (const wc of [undefined, {}, { writeMode: 'EDIT' }, SUGGEST]) {
      assert.strictEqual(decide(update([{ [op]: {} }], wc), G, DIR).decision, 'allow', `${op} ${JSON.stringify(wc)}`);
    }
    assert.strictEqual(decide(update([{ insertComment: { content: 'c' } }, { [op]: {} }]), G, DIR).decision, 'allow', op);
  }
});

test('a direct op does not let a text edit skip SUGGEST', () => {
  const mixed = [{ addDocumentTab: {} }, { insertText: { text: 'x' } }];
  assert.strictEqual(decide(update(mixed), G, DIR).decision, 'deny');
  assert.strictEqual(decide(update(mixed, { writeMode: 'EDIT' }), G, DIR).decision, 'deny');
});

test('comment mixed with an edit needs SUGGEST', () => {
  const mixed = [{ insertComment: { content: 'c' } }, { insertText: { text: 'x' } }];
  assert.strictEqual(decide(update(mixed), G, DIR).decision, 'deny');
  assert.strictEqual(decide(update(mixed, SUGGEST), G, DIR).decision, 'allow');
});

for (const op of [
  'acceptSuggestion',
  'rejectSuggestion',
  'deleteSuggestion',
  'deleteComment',
  'deleteCommentReply',
  'updateCommentPost',
  'deleteTab',
]) {
  test(`${op} is always denied`, () => {
    assert.strictEqual(decide(update([{ [op]: {} }], SUGGEST), G, DIR).decision, 'deny');
  });
}

test('addCommentReply rejects any commentAction other than NO_COMMENT_ACTION_CHANGE', () => {
  const reply = (body) => update([{ addCommentReply: body }], SUGGEST);
  assert.strictEqual(decide(reply({ commentId: 'c', post: { content: 'x', commentAction: 'RESOLVE' } }), G, DIR).decision, 'deny');
  assert.strictEqual(decide(reply({ commentId: 'c', post: { content: 'x', commentAction: 'REOPEN' } }), G, DIR).decision, 'deny');
  assert.strictEqual(decide(reply({ commentId: 'c', commentAction: 'RESOLVE', post: { content: 'x' } }), G, DIR).decision, 'deny');
  assert.strictEqual(decide(reply({ commentId: 'c', post: { content: 'x', commentAction: 'NO_COMMENT_ACTION_CHANGE' } }), G, DIR).decision, 'allow');
  assert.strictEqual(decide(reply({ commentId: 'c', post: { content: 'x' } }), G, DIR).decision, 'allow');
});

test('any other Docs operation is allowed, in SUGGEST only', () => {
  const ops = [
    'insertText', 'deleteContentRange', 'replaceAllText', 'updateTextStyle', 'updateParagraphStyle',
    'createParagraphBullets', 'insertTable', 'insertPageBreak', 'deleteParagraphBullets', 'insertTableRow',
    'insertInlineImage', 'insertSectionBreak', 'createFootnote',
  ];
  for (const op of ops) {
    assert.strictEqual(decide(update([{ [op]: {} }], SUGGEST), G, DIR).decision, 'allow', op);
    assert.strictEqual(decide(update([{ [op]: {} }]), G, DIR).decision, 'deny', op);
  }
});

test('operations on suggestions or comments outside the allowed two are denied by name', () => {
  for (const op of ['acceptAllSuggestions', 'resolveComment', 'updateCommentStatus', 'reopenComment']) {
    assert.strictEqual(decide(update([{ [op]: {} }], SUGGEST), G, DIR).decision, 'deny', op);
  }
});

test('empty, malformed and multi-key requests are denied', () => {
  assert.strictEqual(decide(update([], SUGGEST), G, DIR).decision, 'deny');
  assert.strictEqual(decide(update([{ insertComment: {}, deleteComment: {} }], SUGGEST), G, DIR).decision, 'deny');
  assert.strictEqual(decide(update('nope', SUGGEST), G, DIR).decision, 'deny');
  assert.strictEqual(decide(update([null], SUGGEST), G, DIR).decision, 'deny');
});

test('other Docs and Drive tools are denied', () => {
  const del = { tool_name: 'mcp__claude_ai_Google_Docs__delete_doc', tool_input: { documentId: ID } };
  assert.strictEqual(decide(del, G, DIR).decision, 'deny');
  const drive = { tool_name: 'mcp__claude_ai_Google_Drive__search_files', tool_input: { query: 'x' } };
  assert.strictEqual(decide(drive, G, DIR).decision, 'deny');
});

test('mcp_server name classifies docs, with the suffix after the last __', () => {
  const input = { tool_name: 'mcp__other_prefix__read_doc', mcp_server: { name: 'claude.ai Google Docs' }, tool_input: { documentId: ID } };
  assert.strictEqual(classify(input), 'docs');
  assert.strictEqual(decide(input, G, DIR).decision, 'allow');
  assert.strictEqual(decide(input, [], DIR).decision, 'deny');
  const bad = { ...input, tool_name: 'mcp__other_prefix__delete_doc' };
  assert.strictEqual(decide(bad, G, DIR).decision, 'deny');
});

test('classify', () => {
  assert.strictEqual(classify({ tool_name: 'mcp__x__y', mcp_server: { name: 'claude.ai Google Drive' } }), 'drive');
  assert.strictEqual(classify({ tool_name: 'x', mcp_server: { name: 'claude.ai Google Sheets' } }), 'sheets');
  assert.strictEqual(classify({ tool_name: 'mcp__claude_ai_Google_Sheets__get_values' }), 'sheets');
  assert.strictEqual(classify({ tool_name: 'x', mcp_server: { name: 'claude.ai Google Slides' } }), 'slides');
  assert.strictEqual(classify({ tool_name: 'mcp__claude_ai_Google_Slides__read_presentation' }), 'slides');
  assert.strictEqual(classify({ tool_name: 'Bash' }), 'file-write');
  assert.strictEqual(classify({ tool_name: 'Read' }), 'other');
  assert.strictEqual(classify(null), 'other');
});

test('file writes to the grant dir are denied in every path form', () => {
  const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });
  const cases = [
    bash('rm C:\\Users\\x\\.claude\\gdrive-grants\\s.json'),
    bash('echo > ~/.claude/gdrive-grants/s.json'),
    bash('cp a $HOME/.claude/GDRIVE-GRANTS/s.json'),
    bash('cp a ${HOME}/.claude/gdrive-grants/s.json'),
    bash('rm /c/Users/x/.claude/gdrive-grants/s.json'),
    { tool_name: 'PowerShell', tool_input: { command: 'del %USERPROFILE%\\.claude\\gdrive-grants\\s.json' } },
    { tool_name: 'Write', tool_input: { file_path: `${DIR}\\s.json`, content: '{}' } },
  ];
  for (const c of cases) assert.strictEqual(decide(c, G, DIR).decision, 'deny', JSON.stringify(c));
  assert.strictEqual(decide(cases[1], G, DIR).reason, 'The gdrive grant directory is protected.');
});

test('custom grant dir is protected', () => {
  const input = { tool_name: 'Bash', tool_input: { command: 'rm /tmp/custom-grants/s.json' } };
  assert.strictEqual(decide(input, G, '/tmp/custom-grants').decision, 'deny');
});

test('unrelated tool calls pass', () => {
  assert.strictEqual(decide({ tool_name: 'Bash', tool_input: { command: 'ls src' } }, G, DIR).decision, 'pass');
  const read = { tool_name: 'Read', tool_input: { file_path: `${DIR}\\s.json` } };
  assert.strictEqual(decide(read, G, DIR).decision, 'pass');
});

test('decide routes Sheets calls and fails closed on them', () => {
  const sheet = { tool_name: 'mcp__claude_ai_Google_Sheets__get_values', tool_input: { spreadsheetId: ID, range: 'A1' } };
  assert.strictEqual(decide(sheet, G, DIR).decision, 'allow');
  assert.strictEqual(decide(sheet, [], DIR).decision, 'deny');
  const hostile = { tool_name: 'mcp__claude_ai_Google_Sheets__update_values', get tool_input() { throw new Error('boom'); } };
  assert.strictEqual(decide(hostile, G, DIR).decision, 'deny');
});

test('decide routes Slides calls and fails closed on them', () => {
  const deck = { tool_name: 'mcp__claude_ai_Google_Slides__read_presentation', tool_input: { presentationId: ID } };
  assert.strictEqual(decide(deck, G, DIR).decision, 'allow');
  assert.strictEqual(decide(deck, [], DIR).decision, 'deny');
  const hostile = { tool_name: 'mcp__claude_ai_Google_Slides__update_presentation', get tool_input() { throw new Error('boom'); } };
  assert.strictEqual(decide(hostile, G, DIR).decision, 'deny');
});
