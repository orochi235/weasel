---
'@weasel-js/routing': patch
---

`findConflicts` and `findScopedConflicts` name only bindings that all tie with each other in one conflict: a binding tying with two others that never tie with each other yields two conflicts, one for each pair.

<!-- entry: fix -->
