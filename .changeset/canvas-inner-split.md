---
'@weasel-js/core': patch
---

`<Canvas>`'s body is split into hooks, one per thing it owns: its elements, registered layers, painted cursor, layer stack, view-registry surface, paint, and imperative handle. No behavior or API change.
