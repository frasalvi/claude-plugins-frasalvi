# gdocs-editor Implementation Plan

> **Frozen record** — point-in-time artifact. Never edited retroactively or read from later work; kept only as a historical trace of how the work was done.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code plugin that lets an agent work on Google Docs the lead grants to a session with `/gdocs <link>`, through the claude.ai Google Docs connector, using only suggestions and comments.

**Architecture:** Three Node hooks enforce the containment. A `UserPromptSubmit` hook records the doc IDs the lead types into a per-session grant file. A `PreToolUse` gatekeeper allows Google Docs connector calls only for granted docs and only in suggestion/comment form, and protects the grant files from writes. A `SessionStart` hook prunes long-unused grants. A `/gdocs` command and a `gdocs-editor` skill carry the Overleaf editor model over to Docs.

**Tech Stack:** Node (built-ins only: `fs`, `path`, `os`, `node:test`, `node:assert`, `child_process` in tests), Claude Code plugin hooks, commands and skills.

**Spec:** `docs/superpowers/specs/2026-11-04-gdocs-editor-design.md`

## Global Constraints

- Node built-ins only. No npm dependencies, no `jq`, no Python, no conda.
- Hooks run on Windows under Git Bash. Commands in `hooks.json` use `node "${CLAUDE_PLUGIN_ROOT}/hooks/<script>.js"`. Paths are built with `path`/`os.homedir()`, never hard-coded separators.
- Docs connector tool prefix: `mcp__claude_ai_Google_Docs__`. Drive: `mcp__claude_ai_Google_Drive__`. Identify by `mcp_server.name` first and fall back to the prefix. Task 1 confirms both.
- Grants come only from prompts the lead typed. Accepted triggers: `/gdocs`, `/gdocs-editor:gdocs`, `gdocs:` at the start of the prompt.
- The gatekeeper fails closed for Docs/Drive calls: any error → deny.
- Every JS function gets a Google-style JSDoc (summary, `Args:`, `Returns:`, `Raises:` as applicable). Every JS file's header comment opens with `Review tier: plumbing`.
- Conventional Commits, each commit ending with the session's `Co-Authored-By` / `Claude-Session` lines.
- The new plugin's `README.md` opens with the Living-document tag under its H1. `SKILL.md` and the command file follow the existing plugins and carry no tag.

## Review Focus

1. **Doc link variants:** `/u/1/d/<ID>`, `/edit?usp=sharing`, `#heading=h.x`, trailing `/edit`, and several links in one prompt all grant the same bare IDs. Tested in Task 2.
2. **Hostile or missing `session_id`:** an empty `session_id`, or one containing `..`, `/` or `\`, creates no file, throws nothing and denies every Docs call. Tested in Tasks 2 and 3.
3. **`update_doc` mode loopholes:** an empty `writeControl`, lowercase `"suggest"`, or a comment mixed with edits in `EDIT` mode is denied. Tested in Task 3.
4. **Malformed hook stdin** (non-JSON, empty) on a Docs call is denied, not passed. Tested in Task 4.
5. **Grant-dir path forms in shell commands:** backslashes, forward slashes, `~/.claude/gdocs-grants`, `$HOME/.claude/gdocs-grants` and mixed case are all caught for `Bash`/`PowerShell` writes. Tested in Task 3.

---

## File map

```
plugins/gdocs-editor/
  .claude-plugin/plugin.json
  README.md                         # setup, Node requirement, how /gdocs works
  commands/gdocs.md                 # /gdocs <links> [request]
  skills/gdocs-editor/SKILL.md      # editor behavior
  hooks/hooks.json
  hooks/lib/grants.js               # grant store + link parsing
  hooks/lib/policy.js               # pure allow/deny decision
  hooks/grant.js                    # UserPromptSubmit entry
  hooks/gate.js                     # PreToolUse entry
  hooks/session-start.js            # SessionStart entry (prune)
  hooks/test/grants.test.js
  hooks/test/policy.test.js
  hooks/test/entries.test.js
  hooks/test/fixtures/*.json        # real tool_input shapes from Task 1
.claude-plugin/marketplace.json     # modify: add entry
README.md                           # modify: add plugin line
```

Run all tests with: `node --test plugins/gdocs-editor/hooks/test/`

---

### Task 1: Live connector check (paired with the lead)

The rest of the plan builds on what this task finds. It needs the lead: they log in to the connector and provide a scratch doc.

**Files:**
- Create: `plugins/gdocs-editor/hooks/test/fixtures/read_doc.json`, `update_doc_suggest.json`, `update_doc_comment.json`

**Interfaces:**
- Produces: fixture files containing `{ "tool_name": ..., "tool_input": ... }` exactly as the agent sent them, with the scratch doc's ID kept. Tasks 3 and 4 load them.

- [ ] **Step 1:** Ask the lead to run `/mcp`, authenticate **claude.ai Google Docs**, and paste the link to a new scratch Google Doc containing a few sentences, one comment that says `AI TODO: shorten this sentence`, and the text `AI TODO` in the body. Expected: `mcp__claude_ai_Google_Docs__*` tools appear in the tool list (check with ToolSearch `+Google_Docs`).
- [ ] **Step 2:** Record the real tool names and their input schemas. Expected: `read_doc` and `update_doc` with `documentId`. If the names or shapes differ, update the Global Constraints prefix and tell the lead before continuing.
- [ ] **Step 3:** Call `read_doc` with `commentsIncluded: true`. Record whether it returns a revision ID and how comments (with their IDs and anchors) appear. Save the call as `read_doc.json`.
- [ ] **Step 4:** Call `update_doc` with one `insertText` and `writeControl: { writeMode: "SUGGEST" }`. Ask the lead to confirm that it shows as a suggestion in the Docs UI. Save it as `update_doc_suggest.json`. **If it is applied as a direct edit or rejected, stop and report to the lead (spec: no fallback to `EDIT`).**
- [ ] **Step 5:** Call `update_doc` with one `insertComment` anchored to a range, with no `writeMode`. Then try the same call inside a `SUGGEST` call. Ask the lead to confirm the comment shows anchored. Save the working form as `update_doc_comment.json`. Record whether comments work in `SUGGEST`.
- [ ] **Step 6:** Ask the lead whether a new claude.ai chat shows the Google Docs connector switched on by default. If yes, the README (Task 5) tells them how to switch it off.
- [ ] **Step 7:** Commit the fixtures (`test: add live Google Docs connector fixtures`). Write the findings from Steps 2–6 into the commit body.

---

### Task 2: Grant store and link parsing

**Files:**
- Create: `plugins/gdocs-editor/hooks/lib/grants.js`
- Test: `plugins/gdocs-editor/hooks/test/grants.test.js`

**Interfaces:**
- Produces (CommonJS exports):
  - `grantDir(): string`: `process.env.GDOCS_GRANT_DIR` if set, else `path.join(os.homedir(), '.claude', 'gdocs-grants')`.
  - `isSafeSessionId(id: unknown): boolean`: true only for a non-empty string matching `/^[A-Za-z0-9_-]+$/`.
  - `parseTrigger(prompt: string): string | null`: if the prompt (after leading whitespace) starts with `/gdocs`, `/gdocs-editor:gdocs` or `gdocs:`, followed by whitespace or the end of the prompt, returns the rest; otherwise `null`.
  - `extractDocIds(text: string): string[]`: unique IDs, in order, from `docs.google.com/document/(u/N/)?d/<ID>` links, plus bare whitespace-separated tokens matching `/^[A-Za-z0-9_-]{25,}$/`.
  - `normalizeDocId(value: unknown): string | null`: an ID from a link or a bare ID, else `null`.
  - `readGrants(sessionId: string): string[]`: `[]` if the session ID is unsafe or there is no file.
  - `addGrants(sessionId: string, ids: string[]): string[]`: merges, writes `{ "docs": [...] }` to `<grantDir>/<sessionId>.json` (creating the dir), returns the full list. A no-op returning `[]` for unsafe IDs.
  - `touchGrant(sessionId: string): void`: updates the file's mtime. Ignores a missing file.
  - `pruneGrants(maxAgeDays: number, now?: number): string[]`: deletes `*.json` files in `grantDir()` whose mtime is older than the cutoff and returns the deleted session IDs.

- [ ] **Step 1: Write the failing tests** in `grants.test.js`, using a temp `GDOCS_GRANT_DIR` (`fs.mkdtempSync`) per test:
  - `parseTrigger('/gdocs https://x')` → `'https://x'`; `parseTrigger('  gdocs: a b')` → `'a b'`; `parseTrigger('/gdocs-editor:gdocs x')` → `'x'`; `parseTrigger('please /gdocs x')` → `null`; `parseTrigger('/gdocsfoo x')` → `null`.
  - `extractDocIds` on one prompt with `https://docs.google.com/document/d/AAAAAAAAAAAAAAAAAAAAAAAAAAAA/edit?usp=sharing`, `https://docs.google.com/document/u/1/d/BBBBBBBBBBBBBBBBBBBBBBBBBBBB/edit#heading=h.x`, and the first link again → `['AAAA…', 'BBBB…']`. A bare 28-character token counts. A 10-character word and `https://docs.google.com/spreadsheets/d/CCCC…` do not.
  - `normalizeDocId` of a link → its ID; of a bare ID → itself; of `'short'`, `null`, `42` → `null`.
  - `addGrants('s1', [a])` then `addGrants('s1', [b, a])` → `readGrants('s1')` deep-equals `[a, b]`.
  - For each of `''`, `'../x'`, `'a/b'`, `'a\\b'`, `undefined`: `addGrants(id, [a])` returns `[]`, `readGrants(id)` returns `[]`, and the grant dir has no files.
  - `pruneGrants(30, now)` deletes a file whose mtime (set with `fs.utimesSync`) is 31 days before `now` and keeps one 29 days before.
- [ ] **Step 2: Run** `node --test plugins/gdocs-editor/hooks/test/grants.test.js`. Expected: FAIL (cannot find module).
- [ ] **Step 3: Implement** `hooks/lib/grants.js` with the exports above. Write files with `fs.writeFileSync` to a temp name, then `fs.renameSync`, so a crash never leaves half-written JSON.
- [ ] **Step 4: Run** the same command. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: add gdocs grant store and link parsing`.

---

### Task 3: Gatekeeper policy

**Files:**
- Create: `plugins/gdocs-editor/hooks/lib/policy.js`
- Test: `plugins/gdocs-editor/hooks/test/policy.test.js`

**Interfaces:**
- Consumes: `normalizeDocId`, `grantDir` from Task 2. Fixtures from Task 1.
- Produces: `decide(input: object, grants: string[], grantDirPath: string): { decision: 'allow' | 'deny' | 'pass', reason?: string }`. This is pure: it does no I/O, and the caller supplies the grants. `pass` means "not ours, say nothing". `allow` means "Docs call that passed the checks".
  - Also exported: `classify(input): 'docs' | 'drive' | 'file-write' | 'other'`.

Rules (from the spec's gatekeeper section):
- `classify`: `docs` if `input.mcp_server?.name` matches `/google docs/i` or `tool_name` starts with the Docs prefix. `drive` likewise for Drive. `file-write` for `Edit`, `Write`, `NotebookEdit`, `Bash`, `PowerShell`. Otherwise `other`.
- `drive` → deny.
- `docs`: tool suffix not in `{read_doc, update_doc}` → deny. `normalizeDocId(tool_input.documentId)` is null or not in `grants` → deny, with the reason ``This Google Doc is not granted to this session. Ask the lead to run `/gdocs <link>`.``
- `update_doc`: `requests` must be a non-empty array, and each element must have exactly one key.
  - Always denied: `acceptSuggestion`, `rejectSuggestion`, `deleteSuggestion`, `deleteComment`, `deleteCommentReply`, `updateCommentPost`.
  - Comment ops: `insertComment`. `addCommentReply` is allowed only when `commentAction` is absent or `NO_COMMENT_ACTION_CHANGE`.
  - Edit ops: `insertText`, `deleteContentRange`, `replaceAllText`, `updateTextStyle`, `updateParagraphStyle`, `createParagraphBullets`, `deleteParagraphBullets`, `insertTable`, `insertTableRow`, `insertTableColumn`, `deleteTableRow`, `deleteTableColumn`, `insertPageBreak`.
  - Any other key → deny. If any edit op is present, `tool_input.writeControl?.writeMode` must be exactly `'SUGGEST'`, else deny.
- `file-write`: deny if the lowercased `JSON.stringify(tool_input)`, with `\\` and `\` normalized to `/`, contains any of: the lowercased, slash-normalized `grantDirPath`, `~/.claude/gdocs-grants`, `$home/.claude/gdocs-grants`, `${home}/.claude/gdocs-grants`, `%userprofile%/.claude/gdocs-grants`. Otherwise `pass`.
- `other` → pass.

- [ ] **Step 1: Write the failing tests** in `policy.test.js`, with `G = ['<scratch ID from fixtures>']`:
  - Each Task 1 fixture with grants `G` → `allow`. With grants `[]` → `deny`, and the reason contains `/gdocs`.
  - Fixture `read_doc` with `documentId` set to the full doc link → `allow`.
  - `update_doc` with `[{insertText}]` and no `writeControl` → deny. With `writeControl: {}` → deny. With `writeMode: 'suggest'` → deny. With `'SUGGEST'` → allow.
  - `[{insertComment}, {insertText}]` without `writeMode` → deny.
  - Each always-denied op, alone, in `SUGGEST` → deny. `addCommentReply` with `commentAction: 'RESOLVE'` → deny, with `'NO_COMMENT_ACTION_CHANGE'` → allow.
  - `[{createNamedRange: {}}]` → deny. `requests: []` → deny. A request with two keys → deny.
  - Tool `mcp__claude_ai_Google_Docs__delete_doc` → deny. A Drive `search_files` → deny. An input with `mcp_server: { name: 'claude.ai Google Docs' }` and an unfamiliar `tool_name` prefix is classified `docs`.
  - Review Focus 5: `Bash` commands `rm C:\\Users\\x\\.claude\\gdocs-grants\\s.json` (with `grantDirPath` `C:\\Users\\x\\.claude\\gdocs-grants`), `echo > ~/.claude/gdocs-grants/s.json`, `cp a $HOME/.claude/GDOCS-GRANTS/s.json`, and a `Write` whose `file_path` is in the grant dir → deny. `Bash` `ls src` → pass. `Read` of the grant file → pass.
- [ ] **Step 2: Run** `node --test plugins/gdocs-editor/hooks/test/policy.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `decide` and `classify` in `hooks/lib/policy.js`.
- [ ] **Step 4: Run** it. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: add gdocs gatekeeper policy`.

---

### Task 4: Hook entry points and plugin wiring

**Files:**
- Create: `hooks/grant.js`, `hooks/gate.js`, `hooks/session-start.js`, `hooks/hooks.json`, `.claude-plugin/plugin.json` (all under `plugins/gdocs-editor/`)
- Modify: `.claude-plugin/marketplace.json`
- Test: `plugins/gdocs-editor/hooks/test/entries.test.js`

**Interfaces:**
- Consumes: Task 2 and Task 3 exports.
- Entry behavior (each reads its JSON from stdin):
  - `grant.js`: `parseTrigger(prompt)`. If non-null, it calls `addGrants(session_id, extractDocIds(rest))`. When IDs were added, it prints `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Google Docs granted to this session: <ids>"}}`. When the trigger is present but nothing valid was found, the context says that no doc link was recognized. It never blocks. On any error it exits 0 silently.
  - `gate.js`: computes `decide(input, readGrants(session_id), grantDir())`. On `deny` it prints `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":<reason>}}` and exits 0. On `allow` it calls `touchGrant(session_id)` and exits 0 silently. On `pass` it exits 0 silently. If stdin fails to parse or anything throws, it prints the deny JSON (reason `gdocs gatekeeper error: <message>`) when the raw stdin contains `Google_Docs`, `Google_Drive` or `Google Docs`, and otherwise exits 0 silently.
  - `session-start.js`: calls `pruneGrants(30)`. Silent. Never fails the session.
- `hooks.json` registers:
  - `UserPromptSubmit` → `grant.js`
  - `PreToolUse` with matcher `mcp__.*|^Edit$|^Write$|^NotebookEdit$|^Bash$|^PowerShell$` → `gate.js`, with `"timeout": 10` and `"onFailure": "block"`
  - `SessionStart` → `session-start.js`

  All use the command form from Global Constraints.
- `plugin.json`: same shape as `plugins/overleaf-editor/.claude-plugin/plugin.json`, with name `gdocs-editor`, version `1.0.0`, and description: "Edit Google Docs granted per session through the claude.ai Google Docs connector, as a scientific editor working only in suggestions and comments." The same entry, with keywords `google docs`, `writing`, `editing`, `scientific writing`, is appended to `marketplace.json`.

- [ ] **Step 1: Write the failing tests** in `entries.test.js`. Each spawns `node <script>` with `spawnSync`, passing `input` as stdin and `env.GDOCS_GRANT_DIR` set to a temp dir:
  - `grant.js` with `{session_id:'s1', prompt:'/gdocs <link A> please fix the intro'}` → grant file `s1.json` contains A, and stdout `additionalContext` mentions A.
  - `grant.js` with `prompt: 'look at <link A>'` → no file is created and stdout is empty.
  - `gate.js` with the `read_doc` fixture and `session_id: 's1'` after granting A → stdout empty, exit 0. With `session_id: 's2'` → stdout `permissionDecision` is `deny`.
  - Review Focus 4: `gate.js` with stdin `not json mcp__claude_ai_Google_Docs__read_doc` → deny JSON. With stdin `not json` → empty stdout, exit 0. With empty stdin → exit 0.
  - `session-start.js` with an old grant file present → the file is gone and the exit is 0.
  - `hooks.json` parses as JSON, and every command references an existing script.
- [ ] **Step 2: Run** `node --test plugins/gdocs-editor/hooks/test/entries.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the three entry scripts and the JSON files.
- [ ] **Step 4: Run** `node --test plugins/gdocs-editor/hooks/test/`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: wire gdocs hooks into the gdocs-editor plugin`.

---

### Task 5: `/gdocs` command, editor skill, READMEs

**Files:**
- Create: `plugins/gdocs-editor/commands/gdocs.md`, `plugins/gdocs-editor/skills/gdocs-editor/SKILL.md`, `plugins/gdocs-editor/README.md`
- Modify: `README.md` (repo root; add a `gdocs-editor` line in the style of the others)

**Interfaces:**
- Consumes: the grant context line printed by `grant.js` (Task 4), and the Task 1 findings on comment/suggest call shapes, revision IDs and comment structure.

- [ ] **Step 1: Write `commands/gdocs.md`.** Frontmatter: `description` ("Grant this session access to Google Docs and work on them with the gdocs-editor skill") and `argument-hint: <doc link> [<doc link> ...] [request]`. Body: the links in `$ARGUMENTS` are now granted to this session. Load the `gdocs-editor` skill and carry out the request in `$ARGUMENTS`. With no request, read each doc and report its open AI TODOs.
- [ ] **Step 2: Write `skills/gdocs-editor/SKILL.md`.** Copy the structure and the writing-style, facts-and-numbers and report sections of `plugins/overleaf-editor/skills/overleaf-editor/SKILL.md`. Replace git, LaTeX and push with the spec's "Editor skill" section, point by point:
  - re-read with comments at the start of every request;
  - AI TODOs: comments and body text; do each as a suggestion, reply in the thread, leave it open;
  - new text as one suggestion; edits to existing text as per-sentence suggestions;
  - claims: never change a claim in a style edit; comment, and offer the factual fix as a separate suggestion;
  - noticed problems become comments;
  - model-generated citations get a "model-generated, verify" comment;
  - send suggestions first, then re-read and add comments in a separate call (or combined, if Task 1 showed that works);
  - `requiredRevisionId` from the latest read; on a revision mismatch, re-read and recompute positions;
  - a denied call means the doc isn't granted, so ask the lead for `/gdocs`, and never try to work around the gatekeeper.

  The frontmatter `description` triggers on Google Docs links, "address the AI TODOs in the doc", "draft/edit/polish X in the Google Doc", and `/gdocs`.
- [ ] **Step 3: Write `plugins/gdocs-editor/README.md`** (Living-document tag under the H1):
  - setup: connect only **claude.ai Google Docs** via `/mcp`, never Google Drive; Node on PATH;
  - in claude.ai chats, switch the connector off if Task 1 Step 6 found it on by default;
  - usage: `/gdocs <links> [request]`, or `gdocs: <links>`;
  - grant lifetime: per session, kept on resume, pruned after 30 days unused;
  - what the gatekeeper blocks;
  - known limits: claude.ai chats aren't gated; it isn't hardened against a deliberately hostile agent.

  Add the root `README.md` line.
- [ ] **Step 4: Verify** `node -e "for (const f of ['plugins/gdocs-editor/commands/gdocs.md','plugins/gdocs-editor/skills/gdocs-editor/SKILL.md']) { const t=require('fs').readFileSync(f,'utf8'); if(!/^---\n[\s\S]*?\ndescription:/m.test(t.replace(/\r/g,''))) throw f }"`. Expected: no output. Grep both files for `—` and `---` outside the frontmatter. Expected: none, per the house style.
- [ ] **Step 5: Commit** `feat: add /gdocs command and gdocs-editor skill`.

---

### Task 6: Install and end-to-end check (paired with the lead)

**Files:**
- Modify only if a check fails (the fix goes in the owning file, with a test where possible).

- [ ] **Step 1:** Ask the lead to install the plugin from the worktree's marketplace (`/plugin marketplace add <worktree path>`, then install `gdocs-editor`) and start a fresh session. Expected: `/gdocs` appears in the command list, and `/hooks` shows the three hooks.
- [ ] **Step 2 (spec check 6):** In the fresh session, before any grant, ask the agent to read the scratch doc. Expected: deny, with a reason mentioning `/gdocs`. Then the lead types `/gdocs <scratch link>`. Expected: `~/.claude/gdocs-grants/<session_id>.json` exists, and a read succeeds. If no file appears, the hook didn't see the raw slash text: have the lead use `gdocs: <link>` and switch the README and command docs to that trigger.
- [ ] **Step 3 (spec check 7):** In the granted session, have a subagent read the scratch doc. Expected: allowed. If denied, log the subagent's hook input, key grants on the parent session, add a test, fix.
- [ ] **Step 4 (spec check 9):** Exit, `claude --resume` the session, read the scratch doc. Expected: allowed, no `/gdocs` needed. If denied, implement the spec's fallback (link the new ID at `SessionStart` with `source: resume`) with a test.
- [ ] **Step 5:** In an unrelated fresh session, try to read the scratch doc. Expected: deny. Ask the agent to `rm` the grant file. Expected: deny.
- [ ] **Step 6:** Run the skill once for real on the scratch doc: handle the `AI TODO` comment and polish one sentence. Expected: only suggestions and comments appear in the Docs UI, the TODO thread has a reply and stays open, and the chat report lists what was done.
- [ ] **Step 7:** If agent teams are in use, check whether a teammate session's `UserPromptSubmit` fires on lead-agent messages starting with `/gdocs`. If it does, and the input can't tell those apart from typed prompts, note it in the README's known limits and draft an issue for the lead (don't create it without approval).
- [ ] **Step 8:** Status sweep: check the repo `README.md` and the plugin README against what shipped, run `node --test plugins/gdocs-editor/hooks/test/` (expected: all PASS), make sure `git status` is clean, and commit `docs: finalize gdocs-editor docs after end-to-end check` if anything changed.
