# Google Sheets support and gdrive-editor rename: design

> **Frozen record** — point-in-time artifact. Never edited retroactively or read from later work; kept only as a historical trace of how the work was done.

## Intent

The `gdocs-editor` plugin (branch `feat/gdocs-editor`, PR #5, not yet merged) lets an agent work on Google Docs granted to one session, through suggestions and comments only. The lead wants the same per-session workflow for Google Sheets. Containment stays the hard requirement: a session reaches only the files the lead granted to it, and no other file's content may enter the agent's context.

Sheets has no suggestion mode, so in a granted spreadsheet the agent edits cells directly, doing only what the lead instructed. The lead's undo is the spreadsheet's version history. The lead explicitly wants no further limits on what the agent may do inside a granted spreadsheet.

With Sheets included, the plugin is renamed `gdrive-editor`.

## Goals

- One grant command covers Docs and Sheets links alike: `/gdrive-editor:grant <links> [request]`, or a prompt starting `gdrive: <links> [request]`.
- The gatekeeper allows Google Sheets connector calls only for spreadsheets granted to the session, with the same lifetime rules as Docs (per session, kept on resume, pruned after 30 days unused).
- A `gsheets-editor` skill: the agent reads, does exactly what the lead asked (including AI TODOs the lead left in the sheet), and reports every range it changed with the values it replaced.
- Docs behaviour is unchanged apart from the rename.

## Non-goals

- Google Slides; creating new spreadsheets or docs; Google Drive access of any kind (the Drive connector stays denied).
- Limits on what the agent may change inside a granted spreadsheet (deleting tabs, rows, clearing ranges are all allowed when instructed).
- Comments or suggestions in Sheets.
- Hardening against a deliberately hostile agent.

## Anti-goals

- Data from an ungranted file reaches the agent's context through a granted spreadsheet (for example via a formula that imports another file).
- A spreadsheet link the agent finds on its own grants access.
- The agent changes a sheet without having been asked to, or changes cells beyond what the request covers.
- The agent edits a sheet and the lead cannot tell afterwards what changed.

## Constraints and facts established

Live, on 2026-11-10: the lead added the claude.ai **Google Sheets** connector, and it is connected in Claude Code. Its tools are `mcp__claude_ai_Google_Sheets__<tool>`, nine in all, every one keyed by `spreadsheetId` (camelCase):

| Tool | Writes | Notes |
|---|---|---|
| `get_values` | no | `spreadsheetId`, `range` |
| `get_spreadsheet` | no | `spreadsheetId`, `includeGridData`, `fields`, `commentsIncluded`, `ranges` |
| `update_values` | yes | `spreadsheetId`, `range`, `values` |
| `update_formulas` | yes | `spreadsheetId`, `range`, `formulas` |
| `append_values` | yes | `spreadsheetId`, `range`, `values` |
| `batch_clear_values` | yes | `spreadsheetId`, `ranges` |
| `insert_dimension` | yes | `spreadsheetId`, `sheetId`, `dimension`, `startIndex`, `endIndex` |
| `update_spreadsheet` | yes | `spreadsheetId`, `requests[]` (batchUpdate: values, formatting, add/delete/duplicate sheet, find-replace, sort, charts, protected ranges, comment ops, and more), `writeControl.requiredRevisionId` |
| `copy_sheet_to_another_spreadsheet` | yes | `spreadsheetId`, `sheetId`, `destinationSpreadsheetId` |

No tool searches, lists or opens a file by name. `update_spreadsheet` accepts `writeControl.requiredRevisionId`; the other write tools take no revision guard.

The current plugin (as on `feat/gdocs-editor` at 7cfbc10): grant store `hooks/lib/grants.js` (grant files `~/.claude/gdocs-grants/<session_id>.json` holding `{"docs": [...]}`), pure policy `hooks/lib/policy.js`, entry hooks `grant.js` / `gate.js` / `session-start.js`, command `commands/gdocs.md`, skill `skills/gdocs-editor/SKILL.md`, 50 Node tests. Grants are accepted only from prompts with `source` absent or `user`. The PreToolUse matcher already covers every `mcp__` tool. The bare `/gdocs` short name is not resolved by Claude Code; plugin commands answer only to `<plugin>:<command>`.

## Decided design

### Rename

- Plugin directory, `plugin.json` name, marketplace entry: `gdrive-editor`. Description updated to cover Docs and Sheets.
- Command file `commands/grant.md`, invoked as `/gdrive-editor:grant <links> [request]`.
- Plain-text triggers: `gdrive:` and (kept, harmless) `gdocs:`. Slash triggers recognised by the grant hook: `/gdrive-editor:grant`. Nothing has shipped under the old names, so no other compatibility is needed.
- Grant directory: `~/.claude/gdrive-grants/` (env override renamed to `GDRIVE_GRANT_DIR`). The file-write protection covers the new path in all the forms the current policy covers.
- The skill `gdocs-editor` keeps its name; the new skill is `gsheets-editor`.
- Work continues on `feat/gdocs-editor`, so PR #5 ships the renamed, combined plugin. (Lead's call on the name; the branch choice is the designer's call.)

### Grant

- Link parsing adds `docs.google.com/spreadsheets/(u/N/)?d/<ID>`. Bare long tokens stay accepted as before.
- Docs and Sheets IDs are both Drive file IDs; the grant is a set of file IDs. The gatekeeper checks membership only, so a granted ID is usable with either connector.
- The grant hook's context line names each granted ID with its kind (`doc`, `spreadsheet`, or `unknown` for a bare ID), so the command can load the right skill. For an `unknown` ID the agent reads it with `get_spreadsheet` first; if that fails, it treats it as a doc. (Designer's call.)
- A granted spreadsheet that already imports another file's data (an existing `IMPORTRANGE` the lead wrote, a connected data source) is shown to the agent as is: the gatekeeper cannot see read results, and the lead chose to grant that sheet. The anti-goal covers imports the agent writes. The README lists this under known limits. (Designer's call.)

### Gatekeeper additions

- Classify `sheets` by `mcp_server.name` matching `/google sheets/i`, falling back to the `mcp__claude_ai_Google_Sheets__` prefix.
- Unknown Sheets tool → deny. `spreadsheetId` not granted → deny with the grant instruction in the reason. For `copy_sheet_to_another_spreadsheet`, `destinationSpreadsheetId` must be granted too.
- Every Sheets write (all tools above marked "writes") is allowed as is, except:
  - deny when the call's input, serialized and lower-cased, contains any of `importdata(`, `importxml(`, `importhtml(`, `importfeed(`;
  - `importrange(` is allowed only when every occurrence's first argument is a string literal that resolves (as a bare ID or a spreadsheet URL) to a granted ID. A cell reference, `INDIRECT`, a named range, a concatenation or anything else the gatekeeper cannot resolve is denied. (Designer's call.)
  - a plain-text label that happens to contain one of these strings is denied too; that false positive is accepted. (Designer's call.)
  - `update_spreadsheet` requests that attach or refresh an external data source (`addDataSource`, `updateDataSource`, `refreshDataSource`) are denied, as the same kind of import. (Designer's call.)
- No other restriction on Sheets writes. Comment requests in `update_spreadsheet` are not blocked by the gatekeeper; the skill forbids them.
- Drive stays always denied; the Docs rules are unchanged.

### gsheets-editor skill

- Start every request by reading the spreadsheet structure (tab names, sheet IDs, sizes) and the ranges the request touches, with comments when looking for AI TODOs.
- AI TODOs: the lead may leave them in comments or as cell text. Each is an instruction: do it, and list it in the report. Don't resolve, reply to or write comments.
- Do only what the request covers. Problems noticed elsewhere (a wrong formula, inconsistent data) go in the report as findings, never fixed unasked.
- Before writing, re-read the exact target range; where `update_spreadsheet` is used, pass `requiredRevisionId` from the latest read if the read returns one.
- Report, after every request: each tab and range changed, what it held before (values or formulas; for large ranges, a summary plus the first rows), and anything structural (tabs added or deleted, rows inserted or removed). This is the lead's map for version history.
- A denied call means the spreadsheet isn't granted: ask the lead to grant it, never work around the gatekeeper. A formula-import denial means: don't pull data from other files; tell the lead.
- Writing style rules from `gdocs-editor` apply to any prose the agent writes into cells (labels, notes).

### Command

`/gdrive-editor:grant <links> [request]`: links are granted by the hook. For each granted file, load `gdocs-editor` for a doc and `gsheets-editor` for a spreadsheet, and carry out the request. With no request: for docs, report open AI TODOs as now; for spreadsheets, report the tabs and any AI TODOs found, changing nothing.

## Live checks for the builder (paired with the lead)

1. Does `get_spreadsheet` return a revision ID, and does `update_spreadsheet` reject a stale `requiredRevisionId`?
2. Does `update_values` parse a string beginning with `=` as a formula? (Decides whether value writes need the import check; the decided design checks every write regardless.)
3. With `commentsIncluded`, what shape do Sheets comments take (cell anchor, content, status)?
4. Is the Google Sheets connector switched on by default in new claude.ai chats?
5. End to end with the plugin loaded via `--plugin-dir`: ungranted spreadsheet denied, granted one read and edited, `IMPORTRANGE` of an ungranted spreadsheet denied, copy to an ungranted spreadsheet denied, Docs flow still working under the new names.

## Left to the builder

- Grant file schema details, test layout, and how the policy module is split between Docs and Sheets.
- How `IMPORTRANGE` arguments are parsed, provided unresolvable references are denied.
- Report formatting.
