/**
 * Review tier: plumbing
 *
 * Pure gatekeeper policy for gdrive-editor: decides whether a tool call is
 * allowed, denied, or none of our business. Does no I/O.
 */
'use strict';

const { normalizeDocId } = require('./grants');

const DOCS_PREFIX = 'mcp__claude_ai_Google_Docs__';
const DRIVE_PREFIX = 'mcp__claude_ai_Google_Drive__';
const FILE_WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash', 'PowerShell']);
const DOCS_TOOLS = new Set(['read_doc', 'update_doc']);
const NOT_GRANTED =
  'This file is not granted to this session. Ask the lead to run `/gdrive-editor:grant <link>` or send `gdrive: <link>`.';

const ALWAYS_DENIED = new Set([
  'acceptSuggestion',
  'rejectSuggestion',
  'deleteSuggestion',
  'deleteComment',
  'deleteCommentReply',
  'updateCommentPost',
]);
const COMMENT_OPS = new Set(['insertComment', 'addCommentReply']);
const EDIT_OPS = new Set([
  'insertText',
  'deleteContentRange',
  'replaceAllText',
  'updateTextStyle',
  'updateParagraphStyle',
  'createParagraphBullets',
]);

const GRANT_DIR_FORMS = [
  '~/.claude/gdrive-grants',
  '$home/.claude/gdrive-grants',
  '${home}/.claude/gdrive-grants',
  '%userprofile%/.claude/gdrive-grants',
  '.claude/gdrive-grants',
];

/**
 * Classify a tool call by the system it touches.
 *
 * Args:
 *   input: The hook input object.
 *
 * Returns:
 *   'docs', 'drive', 'file-write' or 'other'.
 */
function classify(input) {
  const name = typeof input?.tool_name === 'string' ? input.tool_name : '';
  const server = typeof input?.mcp_server?.name === 'string' ? input.mcp_server.name : '';
  if (/google docs/i.test(server) || name.startsWith(DOCS_PREFIX)) return 'docs';
  if (/google drive/i.test(server) || name.startsWith(DRIVE_PREFIX)) return 'drive';
  if (FILE_WRITE_TOOLS.has(name)) return 'file-write';
  return 'other';
}

/**
 * Lowercase a string and normalize backslash runs and slash runs to one slash.
 *
 * Args:
 *   s: Input string.
 *
 * Returns:
 *   The normalized string.
 */
function slashNormalize(s) {
  return s.toLowerCase().replace(/\\+/g, '/').replace(/\/+/g, '/');
}

/**
 * Check the requests of an update_doc call.
 *
 * Args:
 *   toolInput: The update_doc tool input.
 *
 * Returns:
 *   A denial reason, or null if the requests are suggestion/comment only.
 */
function checkRequests(toolInput) {
  const requests = toolInput.requests;
  if (!Array.isArray(requests) || requests.length === 0) {
    return 'update_doc needs a non-empty requests array.';
  }
  let hasEdit = false;
  for (const req of requests) {
    if (req === null || typeof req !== 'object' || Array.isArray(req)) {
      return 'Malformed update_doc request.';
    }
    const keys = Object.keys(req);
    if (keys.length !== 1) return 'Each update_doc request must have exactly one operation.';
    const op = keys[0];
    if (ALWAYS_DENIED.has(op)) return `The ${op} operation is not allowed.`;
    if (op === 'addCommentReply') {
      const body = req[op];
      if (body === null || typeof body !== 'object') return 'Malformed addCommentReply.';
      const actions = [body.commentAction, body.post?.commentAction];
      if (actions.some((a) => a !== undefined && a !== 'NO_COMMENT_ACTION_CHANGE')) {
        return 'Replies may not resolve or reopen comment threads.';
      }
    } else if (EDIT_OPS.has(op)) {
      hasEdit = true;
    } else if (!COMMENT_OPS.has(op)) {
      return `The ${op} operation is not allowed.`;
    }
  }
  if (hasEdit && toolInput.writeControl?.writeMode !== 'SUGGEST') {
    return 'Edits must use writeControl.writeMode "SUGGEST".';
  }
  return null;
}

/**
 * Decide on a Docs connector call.
 *
 * Args:
 *   input: The hook input object.
 *   grants: Doc ids granted to the session.
 *
 * Returns:
 *   A decision object.
 */
function decideDocs(input, grants) {
  const name = typeof input.tool_name === 'string' ? input.tool_name : '';
  const suffix = name.slice(name.lastIndexOf('__') + 2);
  if (!DOCS_TOOLS.has(suffix)) return { decision: 'deny', reason: `Docs tool ${suffix} is not allowed.` };
  const toolInput = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {};
  const id = normalizeDocId(toolInput.documentId);
  if (id === null || !Array.isArray(grants) || !grants.includes(id)) {
    return { decision: 'deny', reason: NOT_GRANTED };
  }
  if (suffix === 'update_doc') {
    const reason = checkRequests(toolInput);
    if (reason) return { decision: 'deny', reason };
  }
  return { decision: 'allow' };
}

/**
 * Decide on a file-writing tool call touching the grant directory.
 *
 * Args:
 *   input: The hook input object.
 *   grantDirPath: The grant directory path.
 *
 * Returns:
 *   A decision object.
 */
function decideFileWrite(input, grantDirPath) {
  const text = slashNormalize(JSON.stringify(input.tool_input ?? {}));
  const forms = [...GRANT_DIR_FORMS];
  if (typeof grantDirPath === 'string' && grantDirPath) forms.push(slashNormalize(grantDirPath));
  if (forms.some((f) => text.includes(f))) {
    return { decision: 'deny', reason: 'The gdrive grant directory is protected.' };
  }
  return { decision: 'pass' };
}

/**
 * Decide whether a tool call is allowed, denied, or not ours.
 *
 * Docs and Drive calls fail closed: any error yields a denial.
 *
 * Args:
 *   input: The hook input object.
 *   grants: Doc ids granted to the session.
 *   grantDirPath: The grant directory path.
 *
 * Returns:
 *   `{decision: 'allow' | 'deny' | 'pass', reason?}`.
 */
function decide(input, grants, grantDirPath) {
  let kind;
  try {
    kind = classify(input);
    if (kind === 'drive') return { decision: 'deny', reason: 'Google Drive tools are not allowed.' };
    if (kind === 'docs') return decideDocs(input, grants);
    if (kind === 'file-write') return decideFileWrite(input, grantDirPath);
    return { decision: 'pass' };
  } catch (err) {
    if (kind === 'docs' || kind === 'drive') {
      return { decision: 'deny', reason: 'Could not evaluate the Docs call.' };
    }
    return { decision: 'pass' };
  }
}

module.exports = { decide, classify };
