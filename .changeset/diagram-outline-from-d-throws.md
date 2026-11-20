---
'@weasel-js/diagram': patch
---

`outlineFromD` throws on path data that does not parse or draws nothing, as a mark's path data already does.

The same goes for its `detail`, and a `content` box with no area throws a `RangeError`.

<!-- entry: fix -->
