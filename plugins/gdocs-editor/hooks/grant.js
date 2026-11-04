/**
 * Review tier: plumbing
 *
 * UserPromptSubmit hook: records Google Docs ids the user grants with a
 * `/gdocs <link>` prompt. Never blocks; exits 0 silently on any error.
 */
'use strict';

const fs = require('node:fs');
const { parseTrigger, extractDocIds, addGrants } = require('./lib/grants');

/**
 * Handle one UserPromptSubmit event from stdin.
 *
 * Returns:
 *   Nothing. Prints additionalContext JSON when the prompt is a trigger.
 */
function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (input.source !== undefined && input.source !== 'user') return;
  const rest = parseTrigger(input.prompt);
  if (rest === null) return;
  const ids = extractDocIds(rest);
  const granted = ids.length ? addGrants(input.session_id, ids) : [];
  const context = granted.length
    ? `Google Docs granted to this session: ${ids.join(', ')}`
    : 'No Google Doc link was recognized in the /gdocs prompt; no document was granted.';
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context },
    }),
  );
}

try {
  main();
} catch {
  // never block a prompt
}
