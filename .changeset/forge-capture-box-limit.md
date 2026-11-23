---
'@weasel-js/forge': patch
---

The capture endpoint refuses, with a 400, a box wider or taller than 16384 device pixels at its `dpr`, rather than asking Chromium for an image it cannot draw.

<!-- entry: fix -->
