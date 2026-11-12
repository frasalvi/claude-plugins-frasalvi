# gdrive-editor

> **Living document** — current state only. No history, decision-rationale, or which-subtask-did-what notes; keep it current.

A Claude Code plugin that lets an agent work on Google Docs and Google Sheets through the claude.ai connectors. The agent can reach only the files you grant to a session. In Docs it works as a scientific editor through suggestions and comments (only tabs, page setup and named ranges change directly), and cannot accept suggestions or remove or resolve comments. In Sheets it edits directly, on your instruction, and reports every range it changed so you can find it in version history.

## Setup

- Connect the **claude.ai Google Docs** and **claude.ai Google Sheets** connectors, via `/mcp`. Never connect Google Drive: it can search and list files, which is exactly the exposure this plugin avoids. The gatekeeper denies Drive calls anyway.
- Node must be on the PATH that Claude Code starts with (the hooks are plain Node, no dependencies). Without it, every MCP call is denied until Node is installed and Claude restarted; `Bash`, `Edit` and the other file tools keep working, so you can install it from the session.
- The Google Docs connector is off by default in new claude.ai chats. Switch the connectors on there only knowingly, because chats are not gated (see Known limits).

## Usage

- `/gdrive-editor:grant <link> [<link> ...] [request]` grants the linked docs and spreadsheets to the current session and carries out the request, with the `gdocs-editor` skill for docs and the `gsheets-editor` skill for spreadsheets. Typing `/grant` and picking the command from the autocomplete list gets you there.
- `gdrive: <link> [request]` at the start of a message does the same in plain text (`gdocs:` works too).
- With no request, the agent reports each doc's open AI TODOs and each spreadsheet's tabs and AI TODOs, and changes nothing.

Only links in a prompt you typed that starts with one of these triggers grant access. A link the agent finds in a web page, a paper, a file or another doc grants nothing, and neither does a prompt that did not come from you (a message from another agent, a scheduled or SDK-driven prompt). Published-to-web links (`/spreadsheets/d/e/…`) grant nothing.

## Grant lifetime

A grant belongs to one session and is kept when you resume it. Grant files live in `~/.claude/gdrive-grants/` and are pruned at session start once unused for 30 days. Use of a granted file refreshes its age.

## What the gatekeeper blocks

- Every Google Drive tool.
- Any Docs or Sheets call for a file not granted to the session.

In Docs:

- Any Docs tool other than `read_doc` and `update_doc`.
- Edits outside suggestion mode: every call that edits needs `writeControl.writeMode` exactly `SUGGEST`. Any edit operation is allowed in that mode, including tables and page breaks; Google may apply some it cannot suggest directly, and version history undoes them. The exceptions are operations that cannot be suggestions and leave the text untouched: creating and renaming tabs (`addDocumentTab`, `updateDocumentTabProperties`), page setup (`updateDocumentStyle`) and named ranges (`createNamedRange`, `deleteNamedRange`). These may be sent without `SUGGEST` and apply directly.
- Accepting, rejecting or deleting suggestions, deleting comments or replies, editing comment posts, and resolving or reopening comment threads. Any other operation whose name mentions suggestions or comments is denied too; only `insertComment` and non-resolving `addCommentReply` are allowed.
- Deleting a tab.

In Sheets:

- Copying a tab to a spreadsheet that is not granted.
- Writes containing `IMPORTDATA`, `IMPORTXML`, `IMPORTHTML` or `IMPORTFEED`, in any case.
- Writes containing an `IMPORTRANGE` whose source is not a granted spreadsheet written as a literal link or ID (a cell reference or a built-up string is denied).
- Requests that add, update or refresh an external data source.

Everything else in a granted spreadsheet is allowed, including deleting tabs, rows and ranges.

Everywhere: writes to the grant directory through `Edit`, `Write`, `NotebookEdit`, `Bash` or `PowerShell`. If the gatekeeper itself fails on a Google call, the call is denied. Every MCP call fails closed when the gatekeeper cannot run, because a Google server need not carry the `claude_ai_Google_` prefix; the file tools are let through only when Node is missing entirely, since no grant can exist without it.

## Known limits

- claude.ai chats are not gated: Claude Code hooks do not run there. The connectors cannot search, so a chat reaches a file only if its link is in that chat.
- A granted spreadsheet that already imports another file's data (an `IMPORTRANGE` or data source you set up) shows that data to the agent. The gatekeeper checks what the agent writes, not what it reads.
- If such an `IMPORTRANGE` takes its source from a cell, an ordinary value write to that cell re-points it, and the gatekeeper does not see an import. The `gsheets-editor` skill forbids this, but only the skill does. This works only for sources the spreadsheet has already been allowed to access.
- Plain text that names an import function followed by a parenthesis, such as `importdata(`, is refused as if it were a formula.
- It is not hardened against a deliberately hostile agent on your machine, for example one that finds a creative shell command to rewrite a grant file.

## Tests

```
node --test plugins/gdrive-editor/hooks/test/*.test.js
```
