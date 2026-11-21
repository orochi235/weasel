---
'@weasel-js/p-touch': patch
---

`writeLbx` and `sceneToLbx` throw a `RangeError` for an auto-length label longer than 1000mm. That is the longest P-touch sizes one to (`AUTO_LENGTH_MAX_PT`).

<!-- entry: fix behavior -->
