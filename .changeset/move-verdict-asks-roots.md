---
'@weasel-js/editing': patch
---

A move asks `canDropInto` about the dragged nodes that land on their own, not the ones riding inside another, so a selected child no longer gets its group's drop refused.

<!-- entry: fix -->
