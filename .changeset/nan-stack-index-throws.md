---
'@weasel-js/core': patch
---

`scene.addLayer`, `scene.moveLayer`, `addPage` and `movePage` throw a `RangeError` on a NaN index.

Calls that used to pass silently, moving the layer or page to the bottom and recording `NaN` in the undo entry, now throw and record nothing. An index past either end, `±Infinity` included, is still held to it.

<!-- entry: fix behavior -->
