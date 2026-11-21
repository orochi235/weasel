---
'@weasel-js/renderer': patch
---

`meshHandles` keeps two points of one patch as two handles when they coincide, so a control moved onto its neighbor can still be dragged off it.

<!-- entry: fix -->
