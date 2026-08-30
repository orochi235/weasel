---
'@weasel-js/text': patch
---

Trailing whitespace hangs past the aligned edge

A centered or right-aligned line was positioned on its full advance width,
so a line that happened to end in a space sat half a space off from an
identical line that did not. CSS hangs trailing whitespace and aligns on the
ink; this now does the same.

The space keeps its cell and its advance and simply hangs past the aligned
edge, so nothing about the per-code-point cell mapping changes. Left-aligned
lines were never affected.
