---
'@weasel-js/paint': patch
---

`paintPreviewCss` returns `undefined` for a gradient with a stop color it cannot read, such as `lab()` or `currentColor`, rather than throwing.

<!-- entry: fix -->
