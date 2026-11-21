---
'@weasel-js/theme': patch
---

A generated categorical palette never places a hue at 360°, so `order: 'hue'` keeps a red near 0° first rather than last.

<!-- entry: fix -->
