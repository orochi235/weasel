---
'@weasel-js/prefs-schema': patch
---

A condition reading a list or map entry that holds nothing reads the item's auto value where the item starts auto, and its `defaultScope` where it has one, as a leaf outside a list reads.

<!-- entry: fix -->
