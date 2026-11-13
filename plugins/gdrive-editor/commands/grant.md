---
argument-hint: <link> [<link> ...] [request]
description: Grant this session access to Google Docs, Sheets and Slides and work on them
---

The files linked in `$ARGUMENTS` are now granted to this session. The grant hook has already recorded them, and its context line `Files granted to this session:` names each file's ID and kind. If it says no link was recognized, tell the lead and stop.

For each granted file, load the matching skill:

- `doc`: the `gdocs-editor` skill.
- `spreadsheet`: the `gsheets-editor` skill.
- `presentation`: the `gslides-editor` skill.
- `unknown` (a bare ID): try `get_spreadsheet` on it first, then `read_presentation` (with a `fields` mask of `presentationId`); if both fail, treat it as a doc.

Carry out the request in `$ARGUMENTS`: the text that follows the links.

If there is no request, change nothing. For each doc, read it with its comments and report its open AI TODOs (comments and body text). For each spreadsheet, report its tabs and its AI TODOs (comments and cell text). For each presentation, report its slides and its AI TODOs (comments and slide text).

$ARGUMENTS
