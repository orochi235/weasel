---
'@weasel-js/core': patch
---

`usePointerStylus(ref)` listens to the element its ref holds once attached, and follows the ref to a new one.

An empty ref no longer falls back to the whole page.

<!-- entry: fix behavior -->
