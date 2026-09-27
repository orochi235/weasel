---
'@weasel-js/core': patch
---

`backgroundFill` now draws beneath every other layer. It used to be slotted just before the scene, which put it above the grid and above any custom layer also anchored `before: 'scene'`, so a canvas with a background fill painted over both.
