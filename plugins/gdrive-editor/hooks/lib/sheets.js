/**
 * Review tier: plumbing
 *
 * Pure gatekeeper policy for Google Sheets connector calls: only granted
 * spreadsheets, and no write that could pull another file's or the web's
 * data into the agent's context. Does no I/O.
 */
'use strict';

const { normalizeFileId, NOT_GRANTED } = require('./grants');

const READ_TOOLS = new Set(['get_values', 'get_spreadsheet']);
const WRITE_TOOLS = new Set([
  'update_values',
  'update_formulas',
  'append_values',
  'batch_clear_values',
  'insert_dimension',
  'update_spreadsheet',
  'copy_sheet_to_another_spreadsheet',
]);
const DATA_SOURCE_OPS = new Set(['addDataSource', 'updateDataSource', 'refreshDataSource']);
const WEB_IMPORT_RE = /import(?:data|xml|html|feed)\s*\(/i;
const IMPORTRANGE_RE = /importrange\s*\(/gi;
const LITERAL_ARG_RE = /^\s*"([^"]*)"\s*[,;)]/;

/**
 * Collect every string value nested anywhere in a value, keys excluded.
 *
 * Args:
 *   value: Any JSON-like value.
 *   out: Accumulator array.
 *
 * Returns:
 *   The accumulator, holding every nested string.
 */
function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value !== null && typeof value === 'object') for (const v of Object.values(value)) collectStrings(v, out);
  return out;
}

/**
 * Check that every IMPORTRANGE in a string targets a granted spreadsheet.
 *
 * Args:
 *   text: A string from the tool input.
 *   grants: File ids granted to the session.
 *
 * Returns:
 *   True when every IMPORTRANGE's first argument is a string literal that
 *   resolves to a granted id (or there is none).
 */
function importRangesGranted(text, grants) {
  for (const m of text.matchAll(IMPORTRANGE_RE)) {
    const arg = LITERAL_ARG_RE.exec(text.slice(m.index + m[0].length));
    const id = arg ? normalizeFileId(arg[1]) : null;
    if (id === null || !grants.includes(id)) return false;
  }
  return true;
}

/**
 * Find the reason a Sheets write must be denied, if any.
 *
 * Args:
 *   suffix: The tool name suffix.
 *   toolInput: The tool input.
 *   grants: File ids granted to the session.
 *
 * Returns:
 *   A denial reason, or null if the write is allowed.
 */
function writeViolation(suffix, toolInput, grants) {
  // external data sources
  if (suffix === 'update_spreadsheet' && Array.isArray(toolInput.requests)) {
    for (const req of toolInput.requests) {
      if (req !== null && typeof req === 'object' && Object.keys(req).some((k) => DATA_SOURCE_OPS.has(k))) {
        return 'External data sources are not allowed.';
      }
    }
  }

  // import formulas anywhere in the input
  const strings = collectStrings(toolInput);
  if (strings.some((s) => WEB_IMPORT_RE.test(s))) {
    return 'Formulas that import data from other files or the web are not allowed.';
  }
  if (!strings.every((s) => importRangesGranted(s, grants))) {
    return 'IMPORTRANGE may only reference a spreadsheet granted to this session, written as a literal link or ID.';
  }
  return null;
}

/**
 * Decide on a Google Sheets connector call.
 *
 * Args:
 *   input: The hook input object.
 *   grants: File ids granted to the session.
 *
 * Returns:
 *   `{decision: 'allow' | 'deny', reason?}`.
 */
function decideSheets(input, grants) {
  const name = typeof input.tool_name === 'string' ? input.tool_name : '';
  const suffix = name.slice(name.lastIndexOf('__') + 2);
  if (!READ_TOOLS.has(suffix) && !WRITE_TOOLS.has(suffix)) {
    return { decision: 'deny', reason: `Sheets tool ${suffix} is not allowed.` };
  }
  const granted = Array.isArray(grants) ? grants : [];
  const toolInput = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {};

  // every spreadsheet the call touches must be granted
  const ids = [toolInput.spreadsheetId];
  if (suffix === 'copy_sheet_to_another_spreadsheet') ids.push(toolInput.destinationSpreadsheetId);
  for (const value of ids) {
    const id = normalizeFileId(value);
    if (id === null || !granted.includes(id)) return { decision: 'deny', reason: NOT_GRANTED };
  }

  if (WRITE_TOOLS.has(suffix)) {
    const reason = writeViolation(suffix, toolInput, granted);
    if (reason) return { decision: 'deny', reason };
  }
  return { decision: 'allow' };
}

module.exports = { decideSheets };
