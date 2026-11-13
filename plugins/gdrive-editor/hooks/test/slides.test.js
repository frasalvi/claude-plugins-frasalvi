/**
 * Review tier: plumbing
 *
 * Tests for the Google Slides gatekeeper policy.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { decideSlides } = require('../lib/slides');

const D = 'D'.repeat(44);
const S = 'S'.repeat(44);
const X = 'X'.repeat(44);
const G = [D];
const P = 'mcp__claude_ai_Google_Slides__';
const url = (id) => `https://docs.google.com/presentation/d/${id}/edit#slide=id.p`;

/**
 * Build a Slides hook input for the granted presentation.
 *
 * Args:
 *   tool: Tool suffix.
 *   toolInput: Extra tool input fields.
 *
 * Returns:
 *   A hook input object.
 */
function call(tool, toolInput) {
  return { tool_name: `${P}${tool}`, tool_input: { presentationId: D, ...toolInput } };
}

/**
 * Build an update_presentation input from requests.
 *
 * Args:
 *   requests: The batchUpdate requests.
 *
 * Returns:
 *   A hook input object.
 */
function update(requests) {
  return call('update_presentation', { requests });
}

/**
 * Decide on a call and return only the decision.
 *
 * Args:
 *   input: Hook input.
 *   grants: Granted ids.
 *
 * Returns:
 *   'allow' or 'deny'.
 */
function verdict(input, grants = G) {
  return decideSlides(input, grants).decision;
}

test('every Slides tool is allowed on a granted presentation and denied otherwise', () => {
  const inputs = [
    call('read_presentation', { commentsIncluded: true }),
    call('read_slide_page', { pageId: 'p' }),
    call('read_slide_page_thumbnail', { pageId: 'p' }),
    update([{ insertText: { objectId: 'o', text: 'hi' } }]),
  ];
  for (const input of inputs) {
    assert.strictEqual(verdict(input, G), 'allow', input.tool_name);
    const denied = decideSlides(input, []);
    assert.strictEqual(denied.decision, 'deny', input.tool_name);
    assert.match(denied.reason, /\/gdrive-editor:grant/);
  }
});

test('presentationId may be a granted URL; missing or non-string is denied', () => {
  assert.strictEqual(verdict(call('read_presentation', { presentationId: url(D) })), 'allow');
  assert.strictEqual(verdict({ tool_name: `${P}read_presentation`, tool_input: {} }), 'deny');
  assert.strictEqual(verdict(call('read_presentation', { presentationId: 42 })), 'deny');
  assert.strictEqual(verdict({ tool_name: `${P}read_presentation` }), 'deny');
});

test('unknown Slides tools are denied', () => {
  const out = decideSlides(call('create_presentation', {}), G);
  assert.strictEqual(out.decision, 'deny');
  assert.strictEqual(out.reason, 'Slides tool create_presentation is not allowed.');
});

test('a Sheets chart must come from a granted spreadsheet', () => {
  const chart = (spreadsheetId) =>
    update([{ createSheetsChart: { spreadsheetId, chartId: 1, linkingMode: 'LINKED', elementProperties: { pageObjectId: 'p' } } }]);
  assert.strictEqual(verdict(chart(S), [D]), 'deny');
  assert.strictEqual(verdict(chart(S), [D, S]), 'allow');
  assert.strictEqual(verdict(chart(`https://docs.google.com/spreadsheets/d/${S}/edit`), [D, S]), 'allow');
  assert.strictEqual(verdict(chart(undefined), [D, S]), 'deny');
  const out = decideSlides(chart(X), [D, S]);
  assert.strictEqual(out.reason, 'Sheets charts may only come from a spreadsheet granted to this session.');
});

test('a chart request later in the batch is still checked', () => {
  const requests = [
    { createSlide: {} },
    { createSheetsChart: { spreadsheetId: X, chartId: 1, linkingMode: 'NOT_LINKED_IMAGE', elementProperties: { pageObjectId: 'p' } } },
  ];
  assert.strictEqual(verdict(update(requests), [D, S]), 'deny');
});

test('Drive videos are denied; YouTube videos are allowed', () => {
  const video = (source) => update([{ createVideo: { source, id: 'abc', elementProperties: { pageObjectId: 'p' } } }]);
  const out = decideSlides(video('DRIVE'), G);
  assert.strictEqual(out.decision, 'deny');
  assert.strictEqual(out.reason, 'Videos from Google Drive are not allowed.');
  assert.strictEqual(verdict(video('drive')), 'deny');
  assert.strictEqual(verdict(video('YOUTUBE')), 'allow');
});

test('other structural writes are allowed, including deletes and public images', () => {
  const requests = [
    { deleteObject: { objectId: 'slide1' } },
    { createImage: { url: 'https://example.com/a.png', elementProperties: { pageObjectId: 'p' } } },
    { replaceAllText: { replaceText: 'b', containsText: { text: 'a' } } },
    { refreshSheetsChart: { objectId: 'c' } },
  ];
  assert.strictEqual(verdict(update(requests)), 'allow');
});

test('malformed requests are denied', () => {
  for (const requests of [undefined, 'x', [null], [[]], [42]]) {
    assert.strictEqual(verdict(update(requests)), 'deny', JSON.stringify(requests));
  }
});
