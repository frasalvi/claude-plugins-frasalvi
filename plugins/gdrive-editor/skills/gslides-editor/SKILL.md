---
name: gslides-editor
description: Edit a Google Slides deck directly, on the lead's instruction, via the claude.ai Google Slides connector. Use when the user shares a Google Slides link, asks to address the AI TODOs in a deck, asks to add, change, reorder, restyle or delete slides, text, tables, shapes, images or charts in a granted presentation, or types `/gdrive-editor:grant` or `gdrive:` with a Slides link. Covers reading first, doing only what was asked, checking the result visually, the change report, and why some embeds are refused.
---

# Google Slides editor

The lead owns the deck. You edit it directly: Slides has no suggestion mode, so every write lands at once. The lead's undo is the deck's version history, and your report is their map to it. So do exactly what the lead asked, nothing more, and say precisely what you changed.

## Access

Only presentations the lead granted with `/gdrive-editor:grant <link>` (or a message starting `gdrive: <link>`) are reachable. A hook enforces this. If a call is denied as not granted, ask the lead to grant the presentation, and never try to work around the gatekeeper (another tool, Drive, a different call shape).

Use only the Google Slides tools. Never use Google Drive tools.

## The tools

| Tool | Use it to |
|---|---|
| `read_presentation` | Read the deck: slides, their elements and text, layouts, comments, revision ID |
| `read_slide_page` | Read one slide (or layout or master) by its object ID |
| `read_slide_page_thumbnail` | Get a rendered image of one slide (as a `contentUrl`), to check layout and overflow by eye |
| `update_presentation` | Every edit, as `requests[]`: create, duplicate, move or delete slides; insert, delete or replace text; style text and paragraphs; shapes, tables, lines, images, Sheets charts; transforms and properties |

Every call takes `presentationId`. Slides, shapes, tables and other elements are addressed by `objectId`; text positions are zero-based character indices within one shape or table cell. Sizes and positions use `EMU` (914400 per inch) or `PT`.

Use a `fields` mask on reads: a full deck is large. Typical masks are `slides(objectId,pageElements(objectId,shape(text,placeholder),table,image,sheetsChart))` for content and `revisionId` for the write guard. Comments need `commentsIncluded: true` and both `comments` and `slides(objectId,commentAnchors)` in the mask; leave either out and they are silently dropped. A mask path the API does not know fails with "Request contains an invalid argument".

## Start every request the same way

1. **Read the deck and its comments**: `read_presentation` with `commentsIncluded: true`. Co-authors may have edited since your last look.
2. **Scan for AI TODOs**: OPEN comments whose `headPost.content` contains "AI TODO", and slide text or speaker notes containing "AI TODO". A comment's location is in its slide's `commentAnchors`: match `comments[].anchorId` to `slides[].commentAnchors[].anchorId` and read its `objectAnchors[].objectId` (the element it sits on).
3. **Read what the request touches**: the slides and elements you will change, with their text. Keep what they held: you will report it. When layout matters, look at the slide's thumbnail.

If the lead only gives a link, report the slides (number, title, what each holds) and the open AI TODOs, and stop.

## Doing the work

- **AI TODOs are instructions.** The lead leaves them in comments or as slide text. Do each one, and list it in your report. Never write, reply to, resolve or delete comments; the lead resolves them. Leave "AI TODO" text in place unless the TODO itself asks you to replace it.
- **Do only what the request covers.** A typo, an inconsistent number or a misaligned element you notice elsewhere goes in your report as a finding. Never fix it unasked.
- **Guard against concurrent edits.** Read `revisionId` right before writing and pass it as `writeControl.requiredRevisionId`; a write sent with a stale ID fails with "does not match the latest revision". Then re-read the slides you are changing and redo the edit against what is there now. Each successful write changes the revision, so read it again before the next write.
- **Match the deck.** Reuse its layouts, placeholders, fonts, colors and spacing. A new slide gets a layout from the deck's own master (`slideLayoutReference.layoutId`) rather than a predefined one when the deck uses custom layouts. Prefer filling placeholders over adding free text boxes.
- **Replacing an element.** Some properties, such as a shape's type, cannot be updated. Delete the element and create its replacement under the same `objectId` in the same `update_presentation` call, copying its size, transform, fill, outline and text. Comments anchored to it stay attached.
- **Check the result by eye.** After changing a slide, get its thumbnail (`thumbnailSize: "MEDIUM"` is enough), download the `contentUrl` with `curl` into your scratch directory, and open the PNG with Read. Fix text that overflows its box, overlaps another element or runs off the slide before reporting.
- **Prose on slides** follows the Writing style section of the `gdocs-editor` skill, cut to slide length: short phrases, parallel bullets, no filler.

## Refused embeds

The gatekeeper denies a Sheets chart (`createSheetsChart`) from a spreadsheet that is not granted to this session, and any video from Google Drive (`createVideo` with source `DRIVE`). These would copy another file's content into the deck, and from there into your context. If a request needs one, tell the lead which spreadsheet or video it needs: they can grant the spreadsheet, or insert the video themselves.

The same holds for embeds the lead already set up. Never refresh (`refreshSheetsChart`) a linked chart whose `spreadsheetId` is not granted to this session, and never write a link or ID of a Google file that is not granted into the deck. If a request needs it, tell the lead instead.

Images come from public URLs (`createImage`, `replaceAllShapesWithImage`). Use only an image URL the lead gave you or one from a public source you name in your report.

## Report

End with a report in chat that lets the lead find every change in version history:

- each slide you changed (number and title), with what changed and what the text held before;
- anything structural: slides added, deleted, duplicated or moved, elements added or removed, charts or images inserted;
- the AI TODOs you handled, and how;
- findings you noticed but did not touch, and any assumption you made.
