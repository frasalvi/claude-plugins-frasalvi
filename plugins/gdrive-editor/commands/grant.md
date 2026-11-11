---
argument-hint: <doc link> [<doc link> ...] [request]
description: Grant this session access to Google Docs and Sheets and work on them
---

The Google Docs linked in `$ARGUMENTS` are now granted to this session. The grant hook has already recorded them; if its context line says no doc link was recognized, tell the lead and stop.

Load the `gdocs-editor` skill and carry out the request in `$ARGUMENTS`: the text that follows the links.

If there is no request, read each granted doc with its comments and report its open AI TODOs (comments and body text), without changing anything.

$ARGUMENTS
