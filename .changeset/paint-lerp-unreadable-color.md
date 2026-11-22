---
'@weasel-js/paint': patch
---

`lerpPaint`, `lerpFill` and `lerpStroke` no longer throw on a color `parseColor` cannot read. A paint with `var(--accent)`, `currentColor` or `lab()` holds until halfway, as a paint that cannot mix does.

<!-- entry: fix -->
