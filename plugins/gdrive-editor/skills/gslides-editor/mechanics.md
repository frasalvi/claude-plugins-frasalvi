# Google Slides API mechanics

> **Living document** — current state only. No history, decision-rationale, or which-subtask-did-what notes; keep it current.

These are things the claude.ai Slides connector does that aren't obvious from the API reference. Read this before you build or restyle slides, not just before editing text.

## Geometry

- **Shapes** (`TEXT_BOX`, `RECTANGLE` and the rest) are stored at a base size of 3,000,000 EMU, and their real size lives in the transform. In an `ABSOLUTE` transform, `scaleX = width / 3e6`. Assuming a scale of 1 blows the element up. Read an element's real geometry before resizing it.
- **Images** keep their native pixel size as the base. Read it back before applying an absolute transform. An image keeps its aspect ratio inside the given box.
- The default 16:9 page is 9,144,000 × 5,143,500 EMU (914,400 EMU per inch).

## Creating things

- **IDs:** every `objectId`, slides included, needs at least 5 characters. Use a scheme like `s12_title`.
- **New slides:** create them with a blank layout unless the deck's own layouts fit. "Title and body" leaves "Click to add…" placeholders behind.
- **Shadows:** the API can't set a shadow, so `duplicateObject` an element in the deck that already has one and edit the copy.
- **Cropping:** crop properties are read-only. Crop the image before inserting it, or cover the unwanted part with a mask shape.
- **Images:** the connector only inserts images from public URLs. A local file, a crop or a generated image needs a public host first, such as a secret GitHub gist, and the lead must agree to that. Link third-party copyrighted images from their original URL rather than rehosting them.
- **Superscript:** `baselineOffset: SUPERSCRIPT`.
- **No outline:** set `outline.propertyState: NOT_RENDERED`. Shape fills accept `alpha`.
- **Highlights:** put a text background color on the range. To clear it, list `backgroundColor` in `fields` and give no value.

## Editing

- **Replacing text:** `replaceAllText` (optionally scoped with `pageObjectIds`) keeps the styling. `deleteText` ALL followed by `insertText` inherits the first character's old style and loses paragraph alignment, so restyle the text afterwards.
- **Duplicating:** `duplicateObject` puts the copy right after the original. Pass an `objectIds` map so the copied children get predictable names. Progressive builds are made this way, as one duplicated slide per step.
- **Moving slides:** `updateSlidesPosition` misbehaves with several slides at once, so move one slide at a time to consecutive indices.
- **Layer order:** creation order sets the z-order. Fix it afterwards with `updatePageElementsZOrder` (`BRING_TO_FRONT`).
- **Swapping an image:** `replaceImage` changes an image's URL in place.

## Working at scale

- For many slides, write a small script that emits the `requests` JSON, and send one `update_presentation` call per slide or small group, checking each thumbnail. Very large payloads drop the connection, so reuse elements with `duplicateObject` rather than recreating them.
- When the lead edits at the same time, revision IDs churn. Sending without `writeControl` is acceptable only when the batch touches nothing but objects you created in that same batch. Say so in the report.
