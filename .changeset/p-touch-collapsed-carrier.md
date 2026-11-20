---
'@weasel-js/p-touch': patch
---

`lbxObjectsCommand` objects under a transform that scales an axis to zero are left out of the `.lbx` without a skip report, as the canvas draws nothing there.

<!-- entry: fix data -->
