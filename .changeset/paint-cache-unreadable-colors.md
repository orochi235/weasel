---
'@weasel-js/paint': patch
---

`tryParseColor` and `parseColor` remember a color they cannot read, so a solid of `var(--accent)` or `currentColor` is no longer reparsed, and an error built and caught, on every frame.

<!-- entry: perf fix -->
