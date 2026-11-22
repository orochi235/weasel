---
'@weasel-js/paint': patch
---

Outside a browser, `parsesAsColor` no longer takes `rgb(nonsense)` for a color. An `rgb()`, `hsl()`, `oklab()` or `oklch()` value counts only where `parseColor` reads it.

<!-- entry: fix -->
