---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

`fitViewToBounds` takes `anchor: 'start'`, which shows the left or top edge of bounds that overflow the viewport instead of their middle. `DiagramView` passes it through, alongside a new `minScale` floor on its initial fit.
