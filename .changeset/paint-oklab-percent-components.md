---
'@weasel-js/paint': patch
---

`parseColor` reads percent a and b in `oklab()` and percent chroma in `oklch()`, 100% being 0.4 as in CSS, where it threw on them.

<!-- entry: fix -->
