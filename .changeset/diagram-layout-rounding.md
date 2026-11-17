---
'@weasel-js/diagram': patch
---

`diagram.layout` is disabled after a layout as it promised, rather than staying on for places it wrote a rounding error away from.

<!-- entry: fix -->
