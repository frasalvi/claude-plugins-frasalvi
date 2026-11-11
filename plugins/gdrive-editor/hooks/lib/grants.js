/**
 * Review tier: plumbing
 *
 * Per-session grant store for gdrive-editor and parsing of Google Docs links
 * and trigger prompts. Grants live in `<grantDir>/<sessionId>.json`.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LINK_RE = /docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/g;
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
 * Extract Google Docs document ids from free text.
 *
 * Whole whitespace-separated tokens count as bare ids; a token containing a
 * URL counts only through the Docs link pattern.
 *
 * Args:
 *   text: Text that may contain links or bare ids.
 *
 * Returns:
 *   Unique ids in order of appearance.
 */
function extractDocIds(text) {
  if (typeof text !== 'string') return [];
  const ids = [];
  for (const token of text.split(/\s+/)) {
    const links = [...token.matchAll(LINK_RE)];
    if (links.length) {
      for (const m of links) ids.push(m[1]);
    } else if (BARE_RE.test(token)) {
      ids.push(token);
    }
  }
  return [...new Set(ids)];
}

/**
 * Normalize a link or bare id to a document id.
 *
 * Args:
 *   value: A Docs link or bare id.
 *
 * Returns:
 *   The document id, or null if the value is neither.
 */
function normalizeDocId(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  LINK_RE.lastIndex = 0;
  const m = LINK_RE.exec(v);
  LINK_RE.lastIndex = 0;
  if (m) return m[1];
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
 * Read the doc ids granted to a session.
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
    return Array.isArray(data.docs) ? data.docs.filter((d) => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Merge doc ids into a session's grants and write them atomically.
 *
 * Args:
 *   sessionId: The session id.
 *   ids: Doc ids to add.
 *
 * Returns:
 *   The full grant list; empty (and nothing written) for an unsafe id.
 */
function addGrants(sessionId, ids) {
  if (!isSafeSessionId(sessionId)) return [];
  const docs = [...new Set([...readGrants(sessionId), ...ids])];
  const file = grantFile(sessionId);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(grantDir(), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify({ docs }));
  fs.renameSync(tmp, file);
  return docs;
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
  extractDocIds,
  normalizeDocId,
  readGrants,
  addGrants,
  touchGrant,
  pruneGrants,
};
