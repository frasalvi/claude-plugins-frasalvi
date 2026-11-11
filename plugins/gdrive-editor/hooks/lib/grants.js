/**
 * Review tier: plumbing
 *
 * Per-session grant store for gdrive-editor and parsing of Google Docs and
 * Sheets links and trigger prompts. Grants live in `<grantDir>/<sessionId>.json`.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LINK_RE = /docs\.google\.com\/(document|spreadsheets)\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{25,})/g;
const LINK_KIND = { document: 'doc', spreadsheets: 'spreadsheet' };
const BARE_RE = /^[A-Za-z0-9_-]{25,}$/;
const SESSION_RE = /^[A-Za-z0-9_-]+$/;
const TRIGGER_RE = /^\s*(?:\/gdrive-editor:grant|gdrive:|gdocs:)(?:\s+([\s\S]*)|\s*)$/;

/**
 * Return the directory holding grant files.
 *
 * Returns:
 *   `GDRIVE_GRANT_DIR` if set, else `~/.claude/gdrive-grants`.
 */
function grantDir() {
  return process.env.GDRIVE_GRANT_DIR || path.join(os.homedir(), '.claude', 'gdrive-grants');
}

/**
 * Check that a session id is safe to use as a file name.
 *
 * Args:
 *   id: Candidate session id.
 *
 * Returns:
 *   True only for a non-empty string of letters, digits, `_` and `-`.
 */
function isSafeSessionId(id) {
  return typeof id === 'string' && SESSION_RE.test(id);
}

/**
 * Extract the argument text of a grant trigger prompt.
 *
 * Args:
 *   prompt: The raw user prompt.
 *
 * Returns:
 *   The text after the trigger, or null if the prompt is not a trigger.
 */
function parseTrigger(prompt) {
  if (typeof prompt !== 'string') return null;
  const m = TRIGGER_RE.exec(prompt);
  return m ? (m[1] || '').trim() : null;
}

/**
 * Extract Google Docs and Sheets file ids, with their kinds, from free text.
 *
 * Whole whitespace-separated tokens count as bare ids of unknown kind; a
 * token containing a URL counts only through the Docs and Sheets link
 * patterns.
 *
 * Args:
 *   text: Text that may contain links or bare ids.
 *
 * Returns:
 *   `{id, kind}` entries unique by id, first occurrence winning, in order.
 *   `kind` is 'doc', 'spreadsheet' or 'unknown'.
 */
function extractFileIds(text) {
  if (typeof text !== 'string') return [];
  const found = new Map();
  for (const token of text.split(/\s+/)) {
    const links = [...token.matchAll(LINK_RE)];
    if (links.length) {
      for (const m of links) if (!found.has(m[2])) found.set(m[2], LINK_KIND[m[1]]);
    } else if (BARE_RE.test(token) && !found.has(token)) {
      found.set(token, 'unknown');
    }
  }
  return [...found].map(([id, kind]) => ({ id, kind }));
}

/**
 * Normalize a Docs or Sheets link, or a bare id, to a file id.
 *
 * Args:
 *   value: A Docs or Sheets link, or a bare id.
 *
 * Returns:
 *   The file id, or null if the value is none of these.
 */
function normalizeFileId(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  LINK_RE.lastIndex = 0;
  const m = LINK_RE.exec(v);
  LINK_RE.lastIndex = 0;
  if (m) return m[2];
  return BARE_RE.test(v) ? v : null;
}

/**
 * Build the grant file path for a safe session id.
 *
 * Args:
 *   sessionId: A session id already checked with isSafeSessionId.
 *
 * Returns:
 *   Absolute path of the session's grant file.
 */
function grantFile(sessionId) {
  return path.join(grantDir(), `${sessionId}.json`);
}

/**
 * Read the file ids granted to a session.
 *
 * Args:
 *   sessionId: The session id.
 *
 * Returns:
 *   Granted ids; empty for an unsafe id, a missing file or corrupt JSON.
 */
function readGrants(sessionId) {
  if (!isSafeSessionId(sessionId)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(grantFile(sessionId), 'utf8'));
    return Array.isArray(data.files) ? data.files.filter((d) => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Merge file ids into a session's grants and write them atomically.
 *
 * Args:
 *   sessionId: The session id.
 *   ids: File ids to add.
 *
 * Returns:
 *   The full grant list; empty (and nothing written) for an unsafe id.
 */
function addGrants(sessionId, ids) {
  if (!isSafeSessionId(sessionId)) return [];
  const files = [...new Set([...readGrants(sessionId), ...ids])];
  const file = grantFile(sessionId);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(grantDir(), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify({ files }));
  fs.renameSync(tmp, file);
  return files;
}

/**
 * Refresh a grant file's mtime so active sessions are not pruned.
 *
 * Args:
 *   sessionId: The session id.
 *
 * Returns:
 *   Nothing. A missing file or unsafe id is ignored.
 */
function touchGrant(sessionId) {
  if (!isSafeSessionId(sessionId)) return;
  try {
    const now = new Date();
    fs.utimesSync(grantFile(sessionId), now, now);
  } catch {
    // missing file: nothing to refresh
  }
}

/**
 * Delete grant files not modified within the cutoff.
 *
 * Args:
 *   maxAgeDays: Maximum age in days.
 *   now: Current time in ms since the epoch.
 *
 * Returns:
 *   Session ids of the deleted files.
 */
function pruneGrants(maxAgeDays, now = Date.now()) {
  const dir = grantDir();
  const cutoff = now - maxAgeDays * 86400000;
  const deleted = [];
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const file = path.join(dir, name);
    try {
      if (fs.statSync(file).mtimeMs < cutoff) {
        fs.unlinkSync(file);
        deleted.push(name.slice(0, -'.json'.length));
      }
    } catch {
      // raced with another process: skip
    }
  }
  return deleted;
}

module.exports = {
  grantDir,
  isSafeSessionId,
  parseTrigger,
  extractFileIds,
  normalizeFileId,
  readGrants,
  addGrants,
  touchGrant,
  pruneGrants,
};
