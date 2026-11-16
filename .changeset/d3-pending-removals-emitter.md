---
'@weasel-js/d3': patch
---

The removals a `.remove()` transition holds for each node are kept in registry's `createKeyedEmitter` rather than a map of listener sets.

<!-- entry: internal -->
