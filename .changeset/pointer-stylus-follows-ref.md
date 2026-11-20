---
'@weasel-js/core': patch
---

`usePointerStylus(ref)` listens to the element its ref holds once it is attached, and follows the ref to a new element, instead of falling back to the whole page.

<!-- entry: fix behavior -->
