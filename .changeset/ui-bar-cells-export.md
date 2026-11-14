---
'@weasel-js/ui': minor
---

`barCells(leaves, cellFor)` draws a bar's leaves through your own cell factory, fusing paired toggle flags into one control.

`cellFor` returns each leaf's `render` and the `LeafContext` a fused run reads and writes through. A leaf `renderers` claims never fuses.

<!-- entry: api new -->
