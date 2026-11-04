/**
 * Review tier: plumbing
 *
 * PreToolUse hook: applies the gdocs policy. Prints output only to deny;
 * allow and pass stay silent so unrelated permission flows are untouched.
 * Always exits 0.
 */
'use strict';

const fs = require('node:fs');
const { readGrants, touchGrant, grantDir } = require('./lib/grants');
const { decide } = require('./lib/policy');

/**
 * Print a PreToolUse deny decision.
 *
 * Args:
 *   reason: Human-readable reason.
 *
 * Returns:
 *   Nothing.
 */
function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
}

/**
 * Handle one PreToolUse event.
 *
 * Returns:
 *   Nothing.
 *
 * Raises:
 *   Error: On unreadable or unparsable stdin; the caller decides what to do.
 */
function main() {
  let raw = '';
  try {
    raw = fs.readFileSync(0, 'utf8');
    const input = JSON.parse(raw);
    const result = decide(input, readGrants(input.session_id), grantDir());
    if (result.decision === 'deny') deny(result.reason);
    else if (result.decision === 'allow') touchGrant(input.session_id);
  } catch (err) {
    if (/Google_Docs|Google_Drive|Google Docs/.test(raw)) {
      deny(`gdocs gatekeeper error: ${err.message}`);
    }
  }
}

main();
