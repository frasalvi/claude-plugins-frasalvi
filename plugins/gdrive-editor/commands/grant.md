---
argument-hint: <link> [<link> ...] [request]
description: Grant this session access to Google Docs and Sheets and work on them
---

The files linked in `$ARGUMENTS` are now granted to this session. The grant hook has already recorded them, and its context line `Files granted to this session:` names each file's ID and kind. If it says no link was recognized, tell the lead and stop.

For each granted file, load the matching skill:

- `doc`: the `gdocs-editor` skill.
- `spreadsheet`: the `gsheets-editor` skill.
- `unknown` (a bare ID): try `get_spreadsheet` on it first; if that fails, treat it as a doc.

Carry out the request in `$ARGUMENTS`: the text that follows the links.

If there is no request, change nothing. For each doc, read it with its comments and report its open AI TODOs (comments and body text). For each spreadsheet, report its tabs and its AI TODOs (comments and cell text).

$ARGUMENTS
