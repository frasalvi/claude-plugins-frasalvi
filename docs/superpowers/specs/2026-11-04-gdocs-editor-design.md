# Google Docs editor plugin: design

> **Frozen record** — point-in-time artifact. Never edited retroactively or read from later work; kept only as a historical trace of how the work was done.

## Intent

The lead wants agents in Claude Code to work on their Google Docs the way the `overleaf-editor` skill works on Overleaf papers, acting from the lead's own Google account. The hard requirement is containment. A session may touch only the documents the lead granted to that session, and a session with no grant must not be able to read anything from the lead's Drive. The worry is the lead's files entering an agent's context for any reason, whether an accident, an unrelated task or text the agent read elsewhere. It is not a determined attacker on the lead's machine: the boundary should be reasonably tight, not hardened.

The agent edits only through suggestions and comments, never by direct edits, so every change the agent makes is something the lead accepts or rejects in Google Docs.

## Goals

- One-time setup: connect the claude.ai **Google Docs** connector from the lead's personal Gmail account.
- Per-session grant with one command: the lead types `/gdocs <link> [<link> ...]` in a session, and from then on that session can read and suggest on exactly those documents.
- Every Google Docs tool call in every Claude Code session passes a gatekeeper that allows it only for documents granted to that session. No grant means no access.
- An editor skill, `gdocs-editor`, that carries the `overleaf-editor` model (roles, AI TODOs, new text vs existing text, style, facts, citations, report) over to Google Docs using suggestions and comments.
- The suggestion-and-comment-only rule is enforced by the gatekeeper, not only stated in the skill.

## Non-goals

- Google Drive access of any kind (search, listing, recent files, non-Docs files). The Drive connector stays disconnected.
- Sheets and Slides.
- Gating claude.ai web or desktop chats. Claude Code hooks do not run there; see Constraints.
- Defending against a deliberately hostile agent on the lead's machine (for example one that rewrites the grant file through a creative shell command).
- Creating new Google Docs.

## Anti-goals

These would make it a failure even if it technically works:

- Any session without a `/gdocs` grant can read any document content, title or listing.
- A doc link the agent encounters on its own (in a web page, a paper, another doc, a file in the repo) grants access.
- The agent changes the lead's text directly, or accepts, rejects or deletes suggestions or comments.
- Granting access takes more than typing the command, such as manual sharing or a browser step per session.

## Constraints and facts established

Google's Docs MCP server (`https://docsmcp.googleapis.com/mcp/v1`, Developer Preview) backs the claude.ai Google Docs connector. In Claude Code its tools appear as `mcp__claude_ai_Google_Docs__<tool>`. The exact names are to be confirmed on the live connector. Per Google's reference:

- It has exactly two tools, and both take a single `documentId`:
  - `read_doc(documentId, commentsIncluded?)` returns the document structure and text, optionally with comments.
  - `update_doc(documentId, requests[], writeControl?)` carries `documents.batchUpdate` requests. `writeControl.writeMode` is `EDIT` (the default when unspecified) or `SUGGEST`. Optional `requiredRevisionId` / `targetRevisionId` guard against concurrent changes. Request types include the usual edit operations plus `insertComment` (with an anchor `range`), `addCommentReply` (with `commentAction` `NO_COMMENT_ACTION_CHANGE` | `RESOLVE` | `REOPEN`), `updateCommentPost`, `deleteComment`, `deleteCommentReply`, `acceptSuggestion`, `rejectSuggestion` and `deleteSuggestion`.
- Neither tool can search or list. A call can only reach a document whose ID is already in context.
- Google's reference does not say which request types are allowed under `SUGGEST`, or whether comment operations work in a `SUGGEST` call.

The Drive MCP server has `search_files` and `list_recent_files`, which is exactly the exposure this design avoids. That is why Drive is out.

On the Claude Code side:

- `PreToolUse` hooks fire for MCP tools, including those called by subagents. Their input carries `session_id`, `tool_name`, `tool_input` and an `mcp_server` object (`name`, `source`). A hook can deny with `permissionDecision: "deny"` and a reason. A timed-out hook does not block unless `"onFailure": "block"` is set.
- `UserPromptSubmit` hooks receive the submitted `prompt` text and the `session_id`.
- claude.ai connectors sync into every Claude Code session automatically. claude.ai chats also see the connector, with no gate. Because the connector cannot search, a chat can reach a doc only if its link is in that chat. Whether chats enable the connector by default is unknown.
- The lead's machine is Windows, and hooks run under Git Bash. The plugin must not depend on a conda environment or anything not already present on a stock Claude Code install plus Git for Windows.

## Decided design

### Package

The new plugin is `plugins/gdocs-editor/` in this marketplace and contains:

- the `gdocs-editor` skill (editor behavior),
- the `/gdocs` command (grant and start),
- the hooks (grant recorder, gatekeeper, cleanup).

It is registered in `.claude-plugin/marketplace.json` and listed in `README.md`, following the other plugins.

### Grant: `/gdocs <link> [<link> ...]`

- A `UserPromptSubmit` hook sees prompts that start with `/gdocs`. It extracts document IDs from `docs.google.com/document/d/<ID>` links (bare IDs are also accepted) and records them in a per-session grant file keyed by `session_id`, under a fixed directory in the lead's `~/.claude/`. Grants add up: a second `/gdocs` in the same session adds documents.
- Only text the lead typed grants access. Grant files are never created from tool output, from the agent's messages or from subagent prompts.
- The `/gdocs` command itself then tells the agent to load the `gdocs-editor` skill and do the lead's request on the granted docs. With links only and no request, the agent reads them and reports what is there, including open AI TODOs.

### Gatekeeper (`PreToolUse`)

Every call to a Google Docs connector tool passes these checks:

1. **Document check.** `documentId` must be in the current session's grant file. Otherwise the call is denied, and the reason tells the agent to ask the lead to run `/gdocs <link>`.
2. **`read_doc`:** allowed once the document check passes.
3. **`update_doc`:** allowed only if every request is permitted:
   - Edit requests are allowed only when `writeControl.writeMode` is `SUGGEST`. A call in `EDIT` mode, or with no mode set, is denied if it contains any edit request.
   - Comment requests allowed: `insertComment`, and `addCommentReply` with `NO_COMMENT_ACTION_CHANGE` (or no action).
   - Always denied: `acceptSuggestion`, `rejectSuggestion`, `deleteSuggestion`, `deleteComment`, `deleteCommentReply`, `updateCommentPost`, and `addCommentReply` with `RESOLVE` or `REOPEN`.
   - Unknown request types are denied (fail closed).
4. **Unknown Docs connector tools** (if Google adds tools) are denied until the gatekeeper is updated.
5. **Google Drive connector tools** (`mcp__claude_ai_Google_Drive__*`) are always denied, in case Drive is ever connected.
6. **Grant-file protection.** `Edit`, `Write`, `NotebookEdit` and `Bash`/`PowerShell` calls whose input mentions the grant directory are denied. A simple path-string match is enough.
7. The gatekeeper fails closed. If it errors or times out on a Docs tool call, the call is blocked (`"onFailure": "block"`).

### Lifetime

- The grant lasts until the session ends. A `SessionEnd` hook deletes the session's grant file. A resumed session must re-run `/gdocs`. *(Designer's call.)*
- Stale grant files left behind by crashed sessions are pruned when they are older than a few days, for example at the next `SessionStart`. *(Designer's call; the exact age is for the builder.)*
- Subagents inside a granted session share its grant, because the gatekeeper keys on `session_id`. If the live check shows that subagents get a different `session_id`, the builder should key on the parent session.

### Editor skill: `gdocs-editor`

Modeled on `plugins/overleaf-editor/skills/overleaf-editor/SKILL.md`. Keep its roles, writing style, facts-and-numbers and report sections, adapted as below. *(Copying the shared sections rather than factoring them out is the designer's call: plugins are installed independently.)*

- **Start every request by re-reading** the doc with `read_doc(commentsIncluded: true)`. Co-authors may have edited it, and there is no local copy.
- **AI TODOs** are comments that contain "AI TODO". The skill should also catch "AI TODO" written in the body text *(designer's call)*. The agent does each one as a suggestion, then replies in that comment's thread saying what it did. It leaves the thread open for the lead to resolve.
- **New text** (section, paragraph, caption) goes in as one inserted suggestion, matching the voice and length of the surrounding text.
- **Edits to existing text** go in as small separate suggestions, about one per sentence, so the lead can accept them one by one. Style edits never change a claim. If a claim looks wrong, the agent leaves it as it is, adds a comment on it, and may offer the factual fix as its own separate suggestion.
- **Problems noticed but not asked about** become comments anchored on the passage, not edits.
- **Citations the agent adds** get a comment saying "model-generated, verify". There is no bib file.
- **Concurrent edits.** Positions in Google Docs are character indices, and a co-author typing shifts them. The agent should send `requiredRevisionId` from its latest read with every `update_doc`. If the revision has moved, it re-reads and recomputes before retrying, and never places a suggestion against stale positions.
- **Report** in chat at the end: what was suggested or commented and where, AI TODOs handled, and things for the lead to check.

## To verify on the live connector before building on it

The lead connects the claude.ai Google Docs connector via `/mcp` once. Then check on a scratch document:

1. Tool names and input shapes match the reference, especially where `documentId`, `writeControl.writeMode` and the request types sit in `tool_input` as the hook sees it.
2. `SUGGEST` mode works on a personal Gmail account, and the result shows as normal suggestions in the Docs UI.
3. Whether `insertComment` / `addCommentReply` are accepted inside a `SUGGEST` call, or must go in a separate call. If separate, comment-only calls without `SUGGEST` must stay allowed (step 3 of the gatekeeper already allows this).
4. Comments made with `insertComment` show as anchored to the text in the Docs UI.
5. `read_doc` returns a revision ID usable as `requiredRevisionId`.
6. The `UserPromptSubmit` hook sees the raw `/gdocs ...` text when the lead types it as a slash command.
7. Subagent tool calls carry the parent's `session_id`.
8. Whether claude.ai chats have the connector on by default. If so, tell the lead to switch it off there.

If check 2 or 3 fails in a way that makes suggestion-only editing impossible, stop and go back to the lead. Don't fall back to `EDIT` mode.

## Build order and settled details

These are designer's calls made after a builder review.

- **Live checks come first.** Run them before the gatekeeper is written, and build against the real tool names and input shapes, not the reference.
- **How the gatekeeper finds Google calls.** Register it on all MCP tool calls (`mcp__.*`). Identify Docs and Drive calls by the `mcp_server` field (Claude Code here is 2.1.318, which has it), with the tool-name prefix as a fallback. A renamed prefix must not let calls through unchecked.
- **Grants come only from text the lead typed.** If check 6 shows the hook never sees the raw `/gdocs ...` text, don't fall back to a script the agent can call. Use a plain-text trigger in the lead's message instead, such as a message starting with `gdocs:`, and tell the lead the new syntax.
- **Comments and suggestions go in separate `update_doc` calls** by default, which works whatever check 3 shows. Combining them is an optional optimisation if check 3 allows it. Within one request, the agent sends its suggestions first, re-reads, then anchors comments against the fresh positions.
- **Document IDs.** The grant stores bare IDs: the hook strips links down to the ID. The gatekeeper also normalizes the tool's `documentId` the same way (accepting a full link), then requires an exact match. A call that is missing a field it needs, such as an `update_doc` without `requests`, is denied.
- **Runtime.** The hooks are written in Node. `node` is on the Git Bash PATH on this machine; `jq` is not. The plugin README states Node as a requirement.
- **Fail closed even if the timeout setting is ignored.** If plugin hooks don't honor `"onFailure": "block"`, write the gatekeeper so that any error inside it produces an explicit deny for Docs/Drive calls.
- **Resume.** A `SessionStart` with `source: resume` deletes any grant file for that session. A resumed session always re-runs `/gdocs`, whether or not `SessionEnd` fired.
- **Grant-file protection covers writes only.** Read, Grep and Glob on the grant directory stay allowed: document IDs alone carry no content.

## Left to the builder

- The hook file layout and registration (plugin `hooks/hooks.json` and `commands/` are the expected places).
- The grant directory's exact location and file format.
- How the `/gdocs` command and the `UserPromptSubmit` hook split the work, as long as only lead-typed text creates grants.
- The skill's wording and structure, within the behavior above.
- Tests for the gatekeeper's allow/deny decisions on recorded or synthetic hook inputs.
