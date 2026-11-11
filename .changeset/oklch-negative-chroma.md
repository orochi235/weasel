---
"@weasel-js/paint": patch
---

`parseColor` reads a negative `oklch()` chroma as 0, as CSS clamps it: `oklch(0.6 -0.1 30)` is a gray, not a teal.

<!-- entry: fix visual -->
