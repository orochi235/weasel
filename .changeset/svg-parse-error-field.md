---
"@weasel-js/svg": patch
---

`parseSvg` sets `ParseResult.error` when the text is not an SVG document, so a caller can tell an unreadable file from an empty drawing.

That means malformed XML or a root that is not `<svg>`; the message is still its one warning.

<!-- entry: api -->
