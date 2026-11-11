---
name: gsheets-editor
description: Edit a Google Sheet directly, on the lead's instruction, via the claude.ai Google Sheets connector. Use when the user shares a Google Sheets link, asks to address the AI TODOs in a spreadsheet, asks to add, change, clean, restructure or format data, formulas, charts or tabs in a granted spreadsheet, or types `/gdrive-editor:grant` or `gdrive:` with a Sheets link. Covers reading first, doing only what was asked, the change report, and why import formulas are refused.
---

# Google Sheets editor

The lead owns the spreadsheet. You edit it directly: Sheets has no suggestion mode, so every write lands at once. The lead's undo is the spreadsheet's version history, and your report is their map to it. So do exactly what the lead asked, nothing more, and say precisely what you changed.

## Access

Only spreadsheets the lead granted with `/gdrive-editor:grant <link>` (or a message starting `gdrive: <link>`) are reachable. A hook enforces this. If a call is denied as not granted, ask the lead to grant the spreadsheet, and never try to work around the gatekeeper (another tool, Drive, a different call shape).

Use only the Google Sheets tools. Never use Google Drive tools.

## The tools

| Tool | Use it to |
|---|---|
| `get_spreadsheet` | Read the structure (tabs, sheet IDs, sizes), comments, and with `includeGridData` + `ranges` the formulas and formats of specific cells |
| `get_values` | Read the displayed values of one range |
| `update_values` | Write values to a range. A string starting with `=` is stored as a formula |
| `update_formulas` | Write formulas to a range |
| `append_values` | Add rows after the last row with data |
| `batch_clear_values` | Clear the values of several ranges (formatting stays) |
| `insert_dimension` | Insert empty rows or columns |
| `update_spreadsheet` | Everything else, as `requests[]`: formatting, add, delete, rename or duplicate tabs, sort, find and replace, charts, merges, validation, and more |
| `copy_sheet_to_another_spreadsheet` | Copy a tab; the destination must be granted too |

Every call takes `spreadsheetId`. `update_spreadsheet` and `insert_dimension` address tabs by numeric `sheetId` (from `sheets[].properties.sheetId`), and ranges as zero-based, end-exclusive `GridRange`s. The other tools take A1 ranges such as `Data!A1:B5`.

## Start every request the same way

1. **Read the structure and comments**: `get_spreadsheet` with `commentsIncluded: true` and no `fields` mask (a mask without `comments` silently drops them). Co-authors may have edited since your last look.
2. **Scan for AI TODOs**: OPEN comments whose `headPost.content` contains "AI TODO", and cells whose text contains "AI TODO". A comment's location is in its tab's `commentAnchors`: match `comments[].anchorId` to `sheets[].commentAnchors[].anchorId` and read its `range` (a `GridRange` on that tab).
3. **Read the ranges the request touches**, with `get_values`, or with `get_spreadsheet` (`includeGridData: true`, `ranges`) when formulas or formats matter. Keep what they held: you will report it.

If the lead only gives a link, report the tabs, what each holds, and the open AI TODOs, and stop.

## Doing the work

- **AI TODOs are instructions.** The lead leaves them in comments or as cell text. Do each one, and list it in your report. Never write, reply to, resolve or delete comments; the lead resolves them. Leave an "AI TODO" cell's text in place unless the TODO itself asks you to replace it.
- **Do only what the request covers.** A wrong formula, inconsistent data or a broken reference you notice elsewhere goes in your report as a finding. Never fix it unasked.
- **Re-read the exact target range right before writing.** Sheets never hands out a revision ID, so `writeControl.requiredRevisionId` cannot be used. A fresh read is the only guard against overwriting a co-author's edit.
- **Prefer formulas where the sheet uses them.** A total row should be `=SUM(B2:B4)`, not a typed number, unless the sheet holds static values throughout.
- **Prose in cells** (labels, headers, notes) follows the Writing style section of the `gdocs-editor` skill.

## Imports are refused

The gatekeeper denies any write containing `IMPORTDATA`, `IMPORTXML`, `IMPORTHTML` or `IMPORTFEED`, an `IMPORTRANGE` of anything but a granted spreadsheet written as a literal link or ID, and external data source requests. It also refuses plain text that merely names one of these functions. These would pull data from other files or the web into the sheet, and from there into your context. If a request needs one, don't look for another route: tell the lead what you would import and let them do it.

## Report

End with a report in chat that lets the lead find every change in version history:

- each tab and range you changed, with what it held before (values or formulas; for a large range, a summary and its first rows);
- anything structural: tabs added, deleted or renamed, rows or columns inserted or removed, charts added;
- the AI TODOs you handled, and how;
- findings you noticed but did not touch, and any assumption you made.
