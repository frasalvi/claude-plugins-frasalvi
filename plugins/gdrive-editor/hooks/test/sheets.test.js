/**
 * Review tier: plumbing
 *
 * Tests for the Google Sheets gatekeeper policy.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { decideSheets } = require('../lib/sheets');

const S = '1uZYbz9ZhWlqgxrrGkMAOkT0-xI203wCzku6FXav4470';
const S2 = 'S'.repeat(44);
const X = 'X'.repeat(44);
const G = [S];
const P = 'mcp__claude_ai_Google_Sheets__';
const url = (id) => `https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`;

/**
 * Load a Sheets fixture.
 *
 * Args:
 *   name: Fixture file name without extension.
 *
 * Returns:
 *   The parsed hook input.
 */
function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', `${name}.json`), 'utf8'));
}

/**
 * Build a Sheets hook input for the granted spreadsheet.
 *
 * Args:
 *   tool: Tool suffix.
 *   toolInput: Extra tool input fields.
 *
 * Returns:
 *   A hook input object.
 */
function call(tool, toolInput) {
  return { tool_name: `${P}${tool}`, tool_input: { spreadsheetId: S, ...toolInput } };
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
  return decideSheets(input, grants).decision;
}

for (const name of ['sheets_get_spreadsheet', 'sheets_update_values', 'sheets_update_spreadsheet', 'sheets_copy_sheet']) {
  test(`fixture ${name}: allow when granted, deny when not`, () => {
    assert.strictEqual(verdict(fixture(name), G), 'allow');
    const denied = decideSheets(fixture(name), []);
    assert.strictEqual(denied.decision, 'deny');
    assert.match(denied.reason, /\/gdrive-editor:grant/);
  });
}

test('spreadsheetId may be a granted URL; missing or non-string is denied', () => {
  assert.strictEqual(verdict(call('get_values', { spreadsheetId: url(S), range: 'A1' })), 'allow');
  assert.strictEqual(verdict({ tool_name: `${P}get_values`, tool_input: { range: 'A1' } }), 'deny');
  assert.strictEqual(verdict(call('get_values', { spreadsheetId: 42, range: 'A1' })), 'deny');
  assert.strictEqual(verdict({ tool_name: `${P}get_values` }), 'deny');
});

test('copy needs the destination granted too', () => {
  const copy = call('copy_sheet_to_another_spreadsheet', { sheetId: 0, destinationSpreadsheetId: X });
  assert.strictEqual(verdict(copy, [S]), 'deny');
  assert.strictEqual(verdict(copy, [S, X]), 'allow');
  const noDest = call('copy_sheet_to_another_spreadsheet', { sheetId: 0 });
  assert.strictEqual(verdict(noDest, [S]), 'deny');
});

test('unknown Sheets tools are denied', () => {
  const out = decideSheets(call('get_drive_file', {}), G);
  assert.strictEqual(out.decision, 'deny');
  assert.strictEqual(out.reason, 'Sheets tool get_drive_file is not allowed.');
});

test('web and file import formulas are denied in any case or spacing', () => {
  for (const f of ['=IMPORTXML("https://x","//a")', '=importdata ("u")', '=ImportHtml("u","table",1)', '=importfeed("u")']) {
    const out = decideSheets(call('update_values', { range: 'A1', values: [[f]] }), G);
    assert.strictEqual(out.decision, 'deny', f);
    assert.strictEqual(out.reason, 'Formulas that import data from other files or the web are not allowed.');
  }
});

test('IMPORTRANGE is allowed only for literal granted spreadsheets', () => {
  const formula = (f) => call('update_formulas', { range: 'A1', formulas: [[f]] });
  assert.strictEqual(verdict(formula(`=IMPORTRANGE("${url(S2)}","A1:B2")`), [S]), 'deny');
  assert.strictEqual(verdict(formula(`=IMPORTRANGE("${url(S2)}","A1:B2")`), [S, S2]), 'allow');
  assert.strictEqual(verdict(formula(`=importrange ("${S2}";"A1")`), [S, S2]), 'allow');
  assert.strictEqual(verdict(formula('=IMPORTRANGE(A1,"B1")'), [S, S2]), 'deny');
  assert.strictEqual(verdict(formula(`=IMPORTRANGE("${S2.slice(0, 20)}"&"${S2.slice(20)}","A1")`), [S, S2]), 'deny');
  assert.strictEqual(
    verdict(formula(`=IMPORTRANGE("${S2}","A1")+IMPORTRANGE("${X}","A1")`), [S, S2]),
    'deny',
  );
  const out = decideSheets(formula('=IMPORTRANGE(A1,"B1")'), G);
  assert.strictEqual(
    out.reason,
    'IMPORTRANGE may only reference a spreadsheet granted to this session, written as a literal link or ID.',
  );
});

test('import formulas nested in update_spreadsheet requests are denied', () => {
  const bad = '=IMPORTXML("https://x","//a")';
  const requests = [
    [{ updateCells: { start: { sheetId: 0, rowIndex: 0, columnIndex: 0 }, rows: [{ values: [{ userEnteredValue: { formulaValue: bad } }] }], fields: 'userEnteredValue' } }],
    [{ findReplace: { find: 'x', replacement: bad, allSheets: true } }],
    [{ pasteData: { coordinate: { sheetId: 0, rowIndex: 0, columnIndex: 0 }, data: bad, delimiter: ',' } }],
  ];
  for (const r of requests) assert.strictEqual(verdict(call('update_spreadsheet', { requests: r })), 'deny', JSON.stringify(r));
});

test('an import formula in a later appended row is denied', () => {
  const input = call('append_values', { range: 'Data!A1', values: [['a', 1], ['b', '=IMPORTDATA("u")']] });
  assert.strictEqual(verdict(input), 'deny');
});

test('plain text naming an import function is denied (accepted false positive)', () => {
  assert.strictEqual(verdict(call('update_values', { range: 'A1', values: [['use importdata( carefully']] })), 'deny');
});

test('data source requests are denied; other structural writes are allowed', () => {
  for (const op of ['addDataSource', 'updateDataSource', 'refreshDataSource']) {
    const out = decideSheets(call('update_spreadsheet', { requests: [{ [op]: {} }] }), G);
    assert.strictEqual(out.decision, 'deny', op);
    assert.strictEqual(out.reason, 'External data sources are not allowed.');
  }
  assert.strictEqual(verdict(call('update_spreadsheet', { requests: [{ deleteSheet: { sheetId: 1 } }] })), 'allow');
  assert.strictEqual(verdict(call('update_spreadsheet', { requests: [{ addSheet: {} }] })), 'allow');
  assert.strictEqual(verdict(call('batch_clear_values', { ranges: ['Data!A1:B5'] })), 'allow');
  assert.strictEqual(
    verdict(call('insert_dimension', { sheetId: 0, dimension: 'ROWS', startIndex: 1, endIndex: 2 })),
    'allow',
  );
});

test('reads are not scanned for import text', () => {
  assert.strictEqual(verdict(call('get_values', { range: 'importdata(' })), 'allow');
});
