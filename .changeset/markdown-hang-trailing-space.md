---
'@weasel-js/text': patch
---

`layoutMarkdown` hangs trailing spaces and tabs on every line, as `layoutRuns` and `measureText` do, rather than only on a wrapped one: `ab ` now measures as wide as `ab`, so a label ending in a space or before a newline no longer reports, or aligns by, the extra width.
