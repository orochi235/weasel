---
'@weasel-js/core': patch
---

`createNestedHitTester` passes over a node marked `pickable: false`, so a click on a box's label selects the box.

<!-- entry: fix -->
