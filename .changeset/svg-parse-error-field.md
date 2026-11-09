---
"@weasel-js/svg": patch
---

`parseSvg` now sets `ParseResult.error` when the text is not an SVG document at all (malformed XML, or a root that is not `<svg>`), so a caller can tell an unreadable file from an empty drawing; the message is still its one warning.
