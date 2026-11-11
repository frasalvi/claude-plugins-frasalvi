# gdrive-editor

> **Living document** — current state only. No history, decision-rationale, or which-subtask-did-what notes; keep it current.

A Claude Code plugin that lets an agent work on Google Docs as a scientific editor, through the claude.ai Google Docs connector. The agent can reach only the docs you grant to a session, and it can only add suggestions and comments.

## Setup

- Connect only the **claude.ai Google Docs** connector, via `/mcp`. Never connect Google Drive: it can search and list files, which is exactly the exposure this plugin avoids. The gatekeeper denies Drive calls anyway.
- Node must be on the PATH (the hooks are plain Node, no dependencies).
- The Google Docs connector is off by default in new claude.ai chats. Switch it on there only knowingly, because chats are not gated (see Known limits).

## Usage

- `/gdrive-editor:grant <doc link> [<doc link> ...] [request]` grants the linked docs to the current session and carries out the request with the `gdocs-editor` skill. Typing `/grant` and picking the command from the autocomplete list gets you there.
- `gdrive: <doc link> [request]` at the start of a message does the same in plain text.
- With no request, the agent reads each doc and reports its open AI TODOs.

Only links in a prompt you typed that starts with one of these triggers grant access. A link the agent finds in a web page, a paper, a file or another doc grants nothing, and neither does a prompt that did not come from you (a message from another agent, a scheduled or SDK-driven prompt).

## Grant lifetime

A grant belongs to one session and is kept when you resume it. Grant files live in `~/.claude/gdrive-grants/` and are pruned at session start once unused for 30 days. Use of a granted doc refreshes its age.

## What the gatekeeper blocks

- Every Google Drive tool.
- Any Docs call for a doc not granted to the session, and any Docs tool other than `read_doc` and `update_doc`.
- Edits outside suggestion mode: every edit request needs `writeControl.writeMode` exactly `SUGGEST`.
- Accepting, rejecting or deleting suggestions, deleting comments or replies, editing comment posts, and resolving or reopening comment threads.
- Any request type outside the operations verified to land as suggestions or comments: `insertText`, `deleteContentRange`, `replaceAllText`, `updateTextStyle`, `updateParagraphStyle`, `createParagraphBullets`, `insertComment` and `addCommentReply`. Tables, page breaks and bullet removal are denied.
- Writes to the grant directory through `Edit`, `Write`, `NotebookEdit`, `Bash` or `PowerShell`.

If the gatekeeper itself fails on a Docs call, the call is denied.

## Known limits

- claude.ai chats are not gated: Claude Code hooks do not run there. The connector cannot search, so a chat reaches a doc only if its link is in that chat.
- It is not hardened against a deliberately hostile agent on your machine, for example one that finds a creative shell command to rewrite a grant file.

## Tests

```
node --test plugins/gdrive-editor/hooks/test/*.test.js
```
