---
'@weasel-js/diagram': patch
'@weasel-js/path-tools': patch
---

`central-topic` draws its outline as an oval of four circular arcs instead of an ellipse, flatter across the top, so it holds solid rows and columns at 16px 1x where the ellipse stepped through gray on every side. `blend` is redrawn on the pixel grid at a stroke one pixel wide, with a larger circle, so it no longer renders gray at 1x.
