# gdrive-editor (Sheets support and rename) Implementation Plan

> **Frozen record** — point-in-time artifact. Never edited retroactively or read from later work; kept only as a historical trace of how the work was done.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `gdocs-editor` to `gdrive-editor` and extend its per-session grant and gatekeeper to Google Sheets, with a `gsheets-editor` skill that edits granted spreadsheets directly.

**Architecture:** The grant store becomes a set of Drive file IDs parsed from Docs and Sheets links. The pure policy gains a Sheets branch in its own module: granted spreadsheets only, every write allowed except import formulas and data sources that could pull an ungranted file into the agent's context. A new skill and the renamed `/gdrive-editor:grant` command carry the editing behaviour.

**Tech Stack:** Node built-ins (`fs`, `path`, `os`, `node:test`, `node:assert`, `child_process` in tests), Claude Code plugin hooks, commands and skills.

**Spec:** `docs/superpowers/specs/2026-11-10-gdrive-editor-sheets-design.md`

## Global Constraints

- Branch `feat/gdocs-editor` in the worktree `claude-plugins-frasalvi-gdocs`. PR #5 ships the result.
- Node built-ins only. No npm dependencies, no Python, no conda. Paths built with `path`/`os.homedir()`.
- Plugin name `gdrive-editor`; command file `commands/grant.md`, invoked as `/gdrive-editor:grant <links> [request]`.
- Grant triggers, at the start of a prompt typed by the user: `/gdrive-editor:grant`, `gdrive:`, `gdocs:`. Grants only from prompts with `source` absent or `user` (unchanged).
- Grant directory `~/.claude/gdrive-grants/`, env override `GDRIVE_GRANT_DIR`.
- Skills: `gdocs-editor` (name unchanged), new `gsheets-editor`.
- Sheets connector prefix `mcp__claude_ai_Google_Sheets__`; classify by `mcp_server.name` matching `/google sheets/i` first, prefix second.
- The gatekeeper fails closed for Docs, Sheets and Drive calls: any error → deny.
- Every JS function gets a Google-style JSDoc. Every JS file's header comment opens with `Review tier: plumbing`.
- Conventional Commits, each ending with `Co-Authored-By: Claude <model> <noreply@anthropic.com>` naming the committing model.
- The plugin `README.md` keeps the Living-document tag. `SKILL.md` and command files carry no tag.
- Test command: `node --test plugins/gdrive-editor/hooks/test/*.test.js` (the directory form fails on Node 24).

## Review Focus

1. **Spreadsheet link variants:** `/spreadsheets/u/0/d/<ID>/edit#gid=0`, `/edit?gid=123#gid=123`, a doc link and a sheet link in one prompt (each gets its own kind), and a published link `/spreadsheets/d/e/2PACX-…/pubhtml`, which grants nothing. Tested in Task 3.
2. **`IMPORTRANGE` argument forms:** mixed case `ImportRange`, a space before `(`, `;` as the separator, a full URL or a bare ID as the literal, a cell reference, a `&` concatenation, two calls in one formula with one ungranted. Tested in Task 4.
3. **Import formulas nested deep in a write:** `updateCells…userEnteredValue.formulaValue`, `findReplace.replacement`, `pasteData.data`, and a row inside `append_values.values` are all caught. Tested in Task 4.
4. **`spreadsheetId` shapes:** a full spreadsheet URL is accepted when granted; missing, non-string, or a copy whose `destinationSpreadsheetId` is ungranted is denied. Tested in Task 4.
5. **Malformed hook stdin on a Sheets call** is denied, not passed. Tested in Task 4.

---

## File map (after Task 1)

```
plugins/gdrive-editor/
  .claude-plugin/plugin.json
  README.md
  commands/grant.md                   # renamed from commands/gdocs.md
  skills/gdocs-editor/SKILL.md
  skills/gsheets-editor/SKILL.md      # new, Task 5
  hooks/hooks.json                    # unchanged
  hooks/lib/grants.js
  hooks/lib/policy.js
  hooks/lib/sheets.js                 # new, Task 4
  hooks/grant.js  hooks/gate.js  hooks/session-start.js
  hooks/test/{grants,policy,sheets,entries}.test.js
  hooks/test/fixtures/*.json          # Sheets fixtures added in Task 2
.claude-plugin/marketplace.json
README.md
```

---

### Task 1: Rename to gdrive-editor

**Files:**
- Move: `plugins/gdocs-editor/` → `plugins/gdrive-editor/` (`git mv`); `commands/gdocs.md` → `commands/grant.md`
- Modify: `.claude-plugin/plugin.json`, `hooks/lib/grants.js`, `hooks/lib/policy.js`, `hooks/grant.js`, all three test files, `skills/gdocs-editor/SKILL.md`, `README.md`, root `.claude-plugin/marketplace.json`, root `README.md`

**Interfaces:**
- Produces: `grantDir()` returns `GDRIVE_GRANT_DIR` or `path.join(os.homedir(), '.claude', 'gdrive-grants')`. `parseTrigger` recognises exactly `/gdrive-editor:grant`, `gdrive:`, `gdocs:`. Policy constant `NOT_GRANTED = 'This file is not granted to this session. Ask the lead to run `/gdrive-editor:grant <link>` or send `gdrive: <link>`.'`. `GRANT_DIR_FORMS` are the five current forms with `gdocs-grants` → `gdrive-grants`; the denial reason is `'The gdrive grant directory is protected.'`

- [ ] **Step 1:** `git mv plugins/gdocs-editor plugins/gdrive-editor` and `git mv plugins/gdrive-editor/commands/gdocs.md plugins/gdrive-editor/commands/grant.md`. Commit nothing yet.
- [ ] **Step 2: Update the tests first.** In all test files, `GDOCS_GRANT_DIR` → `GDRIVE_GRANT_DIR` and `gdocs-grants` → `gdrive-grants`. In `grants.test.js` replace the `parseTrigger` cases with: `'/gdrive-editor:grant x'` → `'x'`; `'  gdrive: a b'` → `'a b'`; `'gdocs: a'` → `'a'`; `'/gdrive-editor:grant'` → `''`; `'/gdocs-editor:gdocs x'`, `'/gdocs x'`, `'please gdrive: x'`, `'/gdrive-editor:grantx y'` → `null`. Assert `grantDir()` with the env var unset ends with `path.join('.claude', 'gdrive-grants')`. In `policy.test.js` the not-granted assertions check for `/gdrive-editor:grant`, and the grant-dir cases use `~/.claude/gdrive-grants/s.json`, `$HOME/.claude/gdrive-grants`, `%USERPROFILE%\\.claude\\gdrive-grants` and mixed case.
- [ ] **Step 3: Run** the test command. Expected: FAIL on the trigger, grant-dir and reason assertions.
- [ ] **Step 4: Implement** the Interfaces above in `grants.js` and `policy.js`. `grant.js`'s no-link message becomes `No Google Docs or Sheets link was recognized in the grant prompt; nothing was granted.` (its test updated to match). Rename the plugin to `gdrive-editor` in `plugin.json` and the marketplace entry (`source: ./plugins/gdrive-editor`), and set this description in both: `Edit Google Docs and Sheets granted per session through the claude.ai connectors: Docs as a scientific editor in suggestions and comments only, Sheets by direct edits on your instruction.` Add the keyword `google sheets`. Root `README.md`: rewrite the plugin's line for `gdrive-editor`, `/gdrive-editor:grant <link>` and `gdrive: <link>`. In `SKILL.md` and the plugin `README.md`, replace every `/gdocs-editor:gdocs` with `/gdrive-editor:grant`, every `gdocs:` trigger with `gdrive:`, and `gdocs-grants` with `gdrive-grants`. Update the command file's `description` to `Grant this session access to Google Docs and Sheets and work on them`. Leave the rest of its body to Task 5.
- [ ] **Step 5: Run** the test command. Expected: all PASS. `grep -rn "gdocs-editor:gdocs\|gdocs-grants\|GDOCS_GRANT_DIR" plugins/ README.md .claude-plugin/` returns nothing.
- [ ] **Step 6: Commit** `refactor: rename the plugin to gdrive-editor`.

---

### Task 2: Live Sheets checks (lead, paired with the user)

This can run alongside Task 1. Keep the captured calls in the scratchpad and commit them once Task 1 has landed.

**Files:**
- Create: `plugins/gdrive-editor/hooks/test/fixtures/sheets_get_spreadsheet.json`, `sheets_update_values.json`, `sheets_update_spreadsheet.json`, `sheets_copy_sheet.json`

**Interfaces:**
- Produces: fixtures `{ "tool_name": ..., "tool_input": ... }` exactly as sent, keeping the scratch spreadsheet's ID. Tasks 4 and 5 use them. The findings go in the commit body. Task 5's brief quotes them.

- [ ] **Step 1:** Ask the user for a scratch spreadsheet link with:
  - a tab `Data` holding a few rows of numbers and a second tab;
  - a cell comment `AI TODO: double B2`;
  - a cell containing the text `AI TODO: add a total row`.
- [ ] **Step 2:** `get_spreadsheet` with `commentsIncluded: true` (no grid data). Record whether a revision ID comes back (check 1) and the comment shape: anchor, content, status (check 3). Save the call as a fixture.
- [ ] **Step 3:** `update_values` writing `=1+1` to an empty cell, then `get_values` on it. Record whether it became a formula (check 2). Save the fixture.
- [ ] **Step 4:** If Step 2 returned a revision ID: run `update_spreadsheet` with one harmless request (bold a header cell), passing the ID from before Step 3's write. Record whether it is rejected. Then repeat with a fresh ID and save the fixture. Without a revision ID, save the plain call and record that the guard is unavailable.
- [ ] **Step 5:** `copy_sheet_to_another_spreadsheet` copying the second tab into the same spreadsheet. Save the fixture. Ask the user to delete the copy, or leave it in the scratch sheet.
- [ ] **Step 6:** Ask the user whether a new claude.ai chat shows the Google Sheets connector switched on by default (check 4).
- [ ] **Step 7:** After Task 1, commit the fixtures as `test: add live Google Sheets connector fixtures`. Put the findings for checks 1–4 in the body.

---

### Task 3: Grant Docs and Sheets links as file IDs with kinds

**Files:**
- Modify: `hooks/lib/grants.js`, `hooks/grant.js`, `hooks/lib/policy.js` (import rename only)
- Test: `hooks/test/grants.test.js`, `hooks/test/entries.test.js`

**Interfaces:**
- Consumes: Task 1's `grants.js`.
- Produces:
  - `extractFileIds(text: string): Array<{id: string, kind: 'doc' | 'spreadsheet' | 'unknown'}>`. It replaces `extractDocIds` and returns entries unique by ID, first occurrence winning, in order. Links match `docs.google.com/document/(u/N/)?d/<ID>` → `doc` and `docs.google.com/spreadsheets/(u/N/)?d/<ID>` → `spreadsheet`, with `<ID>` `[A-Za-z0-9_-]{25,}`. A whole bare token matching `/^[A-Za-z0-9_-]{25,}$/` → `unknown`.
  - `normalizeFileId(value: unknown): string | null`. It replaces `normalizeDocId` and accepts either link form or a bare ID. `policy.js` switches to it.
  - Grant file schema `{"files": [id, ...]}`. `addGrants(sessionId, ids: string[])` and `readGrants(sessionId): string[]` keep their signatures. A file with `docs` instead of `files` reads as `[]`.
  - `grant.js` context line: `Files granted to this session: <id> (<kind>), <id> (<kind>).` The no-link message is unchanged from Task 1.

- [ ] **Step 1: Write the failing tests:**
  - `extractFileIds` on one prompt containing a doc link, `https://docs.google.com/spreadsheets/u/0/d/<S>/edit#gid=0`, `https://docs.google.com/spreadsheets/d/<S>/edit?gid=123#gid=123` and a bare 28-character token returns `[{id: D, kind: 'doc'}, {id: S, kind: 'spreadsheet'}, {id: T, kind: 'unknown'}]`.
  - `https://docs.google.com/spreadsheets/d/e/2PACX-1vQabc/pubhtml` → `[]`. A doc link whose ID is 10 characters → `[]`.
  - `normalizeFileId` on a spreadsheet link → its ID.
  - `addGrants` writes `{"files": [...]}`.
  - In `entries.test.js`: `grant.js` with `gdrive: <doc link> <sheet link>` prints a context containing `Files granted to this session:`, `(doc)` and `(spreadsheet)`, and the grant file lists both IDs.
- [ ] **Step 2: Run** the test command. Expected: FAIL (`extractFileIds` is not a function).
- [ ] **Step 3: Implement** the Interfaces above. Update every existing test that used `extractDocIds`/`normalizeDocId` to the new names.
- [ ] **Step 4: Run** the test command. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: grant Google Sheets links alongside Docs`.

---

### Task 4: Sheets gatekeeper

**Files:**
- Create: `hooks/lib/sheets.js`
- Modify: `hooks/lib/policy.js`, `hooks/gate.js`
- Test: `hooks/test/sheets.test.js` (new), `hooks/test/policy.test.js`, `hooks/test/entries.test.js`

**Interfaces:**
- Consumes: `normalizeFileId` (Task 3); fixtures `sheets_*.json` (Task 2).
- Produces:
  - `sheets.js` exports `decideSheets(input: object, grants: string[]): {decision: 'allow' | 'deny', reason?: string}`, a pure function.
  - `policy.classify` returns `'sheets'` for the Sheets connector, checked after Docs and before Drive. `decide` routes `sheets` to `decideSheets`. The catch in `decide` denies for `docs`, `sheets` and `drive`.
  - `gate.js` denies malformed stdin when the raw text matches `/Google_(Docs|Sheets|Drive)|Google (Docs|Sheets|Drive)/`.

Rules for `decideSheets`:
- The tool suffix (after the last `__`) is one of the nine tools. Reads: `get_values`, `get_spreadsheet`. Writes: `update_values`, `update_formulas`, `append_values`, `batch_clear_values`, `insert_dimension`, `update_spreadsheet`, `copy_sheet_to_another_spreadsheet`. Anything else → deny `Sheets tool <suffix> is not allowed.`
- `normalizeFileId(tool_input.spreadsheetId)` must be in `grants`, else deny `NOT_GRANTED`. For the copy tool, `destinationSpreadsheetId` must be granted too. Move `NOT_GRANTED` to `sheets.js` or a shared spot so both modules use one string.
- For writes only, walk every string value anywhere in `tool_input` (keys excluded):
  - `/import(data|xml|html|feed)\s*\(/i` anywhere → deny `Formulas that import data from other files or the web are not allowed.`
  - For every `/importrange\s*\(/i`, the text right after it must match `\s*"([^"]*)"\s*[,;)]`, and `normalizeFileId` of the captured literal must be in `grants`. Otherwise → deny `IMPORTRANGE may only reference a spreadsheet granted to this session, written as a literal link or ID.`
- `update_spreadsheet`: any element of `requests` having a key `addDataSource`, `updateDataSource` or `refreshDataSource` → deny `External data sources are not allowed.`
- Everything else → allow.

- [ ] **Step 1: Write the failing tests** in `sheets.test.js`, with `S` the fixture spreadsheet ID, `G = [S]`, and `S2`, `X` other 44-character IDs:
  - Each `sheets_*.json` fixture → allow with `[S]`, and deny with `[]`.
  - `get_values` with `spreadsheetId` as the full URL of `S` → allow. With `spreadsheetId` missing → deny. With `42` → deny.
  - Copy with `destinationSpreadsheetId: X` → deny with `[S]`, allow with `[S, X]`.
  - `get_drive_file` (unknown suffix) → deny.
  - `update_values` with `values: [["=IMPORTXML(\"https://x\",\"//a\")"]]` → deny. The same for `importdata (`, `ImportHtml(` and `importfeed(` → deny.
  - `update_formulas` with `=IMPORTRANGE("<S2 url>","A1:B2")`: deny with `[S]`, allow with `[S, S2]`. `=importrange ("S2";"A1")` with `[S, S2]` → allow. `=IMPORTRANGE(A1,"B1")` → deny. `=IMPORTRANGE("abc"&"def","A1")` → deny. `=IMPORTRANGE("S2","A1")+IMPORTRANGE("X","A1")` with `[S, S2]` → deny.
  - `update_spreadsheet` holding `=IMPORTXML(` inside `updateCells.rows[0].values[0].userEnteredValue.formulaValue` → deny. Inside `findReplace.replacement` → deny. Inside `pasteData.data` → deny.
  - `append_values` whose second row contains `=IMPORTDATA("u")` → deny.
  - The label text `use importdata( carefully` in `update_values` → deny (an accepted false positive).
  - `update_spreadsheet` with `[{refreshDataSource: {}}]` → deny. With `[{deleteSheet: {sheetId: 1}}]`, `[{addSheet: {}}]` and `batch_clear_values` → allow.
  - `get_values` whose `range` contains `importdata(` → allow (reads are not scanned).
- [ ] **Step 2:** In `policy.test.js`: `classify` returns `'sheets'` for `{tool_name: 'x', mcp_server: {name: 'claude.ai Google Sheets'}}` and for the prefix alone. In `entries.test.js`: `gate.js` stays silent for a granted Sheets fixture, denies it for an ungranted session, and denies stdin `{"tool_name":"mcp__claude_ai_Google_Sheets__get_values",` (truncated JSON).
- [ ] **Step 3: Run** the test command. Expected: FAIL (cannot find `../lib/sheets`).
- [ ] **Step 4: Implement** `sheets.js` and the `policy.js`/`gate.js` changes.
- [ ] **Step 5: Run** the test command. Expected: all PASS, Docs tests included.
- [ ] **Step 6: Commit** `feat: gate Google Sheets calls to granted spreadsheets`.

---

### Task 5: gsheets-editor skill, grant command and README

**Files:**
- Create: `skills/gsheets-editor/SKILL.md`
- Modify: `commands/grant.md`, `README.md` (plugin)

**Interfaces:**
- Consumes: Task 2 findings (the lead pastes them into the brief), the context-line wording from Task 3, the denial reasons from Task 4.

- [ ] **Step 1: Write `skills/gsheets-editor/SKILL.md`** with this frontmatter `description`: `Edit a Google Sheet directly, on the lead's instruction, via the claude.ai Google Sheets connector. Use when the user shares a Google Sheets link, asks to address the AI TODOs in a spreadsheet, asks to add, change, clean, restructure or format data, formulas or tabs in a granted spreadsheet, or types /gdrive-editor:grant or gdrive: with a Sheets link. Covers reading first, doing only what was asked, the change report, and why import formulas are refused.` The body covers each bullet of the spec's "gsheets-editor skill" section. It also covers:
  - the nine tools and when to use each;
  - the call shapes and revision behaviour found in Task 2;
  - the comment shape found in Task 2;
  - a pointer to the `gdocs-editor` skill's Writing style section for prose in cells, which is not copied.
- [ ] **Step 2: Rewrite `commands/grant.md`**: `argument-hint: <link> [<link> ...] [request]`. The body states the spec's Command section:
  - Read the hook's `Files granted to this session:` line. If it says nothing was recognised, tell the lead and stop.
  - Load `gdocs-editor` for each `doc`, and `gsheets-editor` for each `spreadsheet`. For an `unknown` ID, try `get_spreadsheet` first; if that fails, treat it as a doc.
  - Carry out the request. With no request, a doc gets a report of its open AI TODOs; a spreadsheet gets a report of its tabs and AI TODOs; nothing is changed.
- [ ] **Step 3: Update the plugin `README.md`** (current state only):
  - Title and intro cover Docs and Sheets.
  - Setup: connect claude.ai Google Docs and Google Sheets, never Drive. State check 4's result for Sheets.
  - Usage: the two triggers with both link kinds.
  - Grant lifetime: unchanged apart from the path.
  - "What the gatekeeper blocks" gains a Sheets list matching Task 4's rules.
  - Known limits adds two items:
    - a granted sheet's existing imports or data sources are visible to the agent;
    - text containing an import function name is refused.
  - Test command with the new path.
- [ ] **Step 4: Verify.** `node --test plugins/gdrive-editor/hooks/test/*.test.js` passes. `grep -rn "gdocs-editor:gdocs" plugins/gdrive-editor` returns nothing. Both `SKILL.md` frontmatters parse: run `claude --plugin-dir plugins/gdrive-editor -p "list your skills"` from the worktree, or ask the lead to check that the session lists `gdrive-editor:gsheets-editor`.
- [ ] **Step 5: Commit** `feat: add the gsheets-editor skill and the grant command`.

---

### Task 6: End to end (lead, paired with the user)

Live check 5 from the spec, in a fresh `claude --plugin-dir <worktree>/plugins/gdrive-editor` session, on the Task 2 scratch spreadsheet and the Docs scratch doc.

- [ ] **Step 1:** Before any grant, ask for a `get_spreadsheet` on the scratch sheet. Expected: denied with the grant instruction.
- [ ] **Step 2:** Run `/gdrive-editor:grant <sheet link> address the AI TODOs`. Expected:
  - the context line names the sheet as `(spreadsheet)`;
  - `gsheets-editor` loads;
  - B2 is doubled and a total row added;
  - the report lists the ranges with their prior values;
  - no comments are written.
- [ ] **Step 3:** Ask the agent to put `=IMPORTRANGE("<an ungranted sheet ID>","A1")` in a cell → denied. Ask it to copy a tab to that ungranted sheet → denied.
- [ ] **Step 4:** Run `gdrive: <doc link> shorten the first sentence`. Expected: a suggestion plus a `[<model>]` comment, as before. `gdocs: <doc link>` also grants.
- [ ] **Step 5:** Resume the session and read the sheet → allowed. In an unrelated session, read it → denied.
- [ ] **Step 6:** Record the results for the whole-branch review. Fix any failure through the normal task loop before the review.

After the review: rename PR #5 for `gdrive-editor` and rewrite its description. Then run the status sweep, the living-doc audit and `git status`, all through the finishing skill.
