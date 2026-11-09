---
'@weasel-js/core': patch
---

Select All, Copy, and Create Outlines now wait for an in-flight gesture to end, as the other editing keys do: pressed mid-drag, Select All changed the selection under a move or resize that went on moving only what it started with, Copy took the selection as the drag was showing it rather than as it landed, and Create Outlines replaced the nodes being dragged.
