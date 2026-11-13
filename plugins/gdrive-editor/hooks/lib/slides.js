/**
 * Review tier: plumbing
 *
 * Pure gatekeeper policy for Google Slides connector calls: only granted
 * presentations, and no write that embeds content from an ungranted
 * spreadsheet or a Drive file. Does no I/O.
 */
'use strict';

const { normalizeFileId, NOT_GRANTED } = require('./grants');

const READ_TOOLS = new Set(['read_presentation', 'read_slide_page', 'read_slide_page_thumbnail']);
const WRITE_TOOLS = new Set(['update_presentation']);

/**
 * Find the reason an update_presentation call must be denied, if any.
 *
 * Args:
 *   toolInput: The tool input.
 *   grants: File ids granted to the session.
 *
 * Returns:
 *   A denial reason, or null if the write is allowed.
 */
function writeViolation(toolInput, grants) {
  const requests = toolInput.requests;
  if (!Array.isArray(requests)) return 'update_presentation needs a requests array.';
  for (const req of requests) {
    if (req === null || typeof req !== 'object' || Array.isArray(req)) {
      return 'Malformed update_presentation request.';
    }
    const chart = req.createSheetsChart;
    if (chart !== undefined) {
      const id = normalizeFileId(chart?.spreadsheetId);
      if (id === null || !grants.includes(id)) {
        return 'Sheets charts may only come from a spreadsheet granted to this session.';
      }
    }
    const source = req.createVideo?.source;
    if (typeof source === 'string' && source.toUpperCase() === 'DRIVE') {
      return 'Videos from Google Drive are not allowed.';
    }
  }
  return null;
}

/**
 * Decide on a Google Slides connector call.
 *
 * Args:
 *   input: The hook input object.
 *   grants: File ids granted to the session.
 *
 * Returns:
 *   `{decision: 'allow' | 'deny', reason?}`.
 */
function decideSlides(input, grants) {
  const name = typeof input.tool_name === 'string' ? input.tool_name : '';
  const suffix = name.slice(name.lastIndexOf('__') + 2);
  if (!READ_TOOLS.has(suffix) && !WRITE_TOOLS.has(suffix)) {
    return { decision: 'deny', reason: `Slides tool ${suffix} is not allowed.` };
  }
  const granted = Array.isArray(grants) ? grants : [];
  const toolInput = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {};

  const id = normalizeFileId(toolInput.presentationId);
  if (id === null || !granted.includes(id)) return { decision: 'deny', reason: NOT_GRANTED };

  if (WRITE_TOOLS.has(suffix)) {
    const reason = writeViolation(toolInput, granted);
    if (reason) return { decision: 'deny', reason };
  }
  return { decision: 'allow' };
}

module.exports = { decideSlides };
