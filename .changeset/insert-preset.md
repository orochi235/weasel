---
'@weasel-js/editing': minor
---

`insertPreset` turns on drag-to-insert and click-to-place: the `insert` dep, and the actions a tool that makes a node binds.

Its `insert`, `place`, `insert.adjustRotation` and `insert.reposition` actions register once a tool or binding on the canvas names them, and its dep builds the kit's kinds (`KIT_INSERT_KINDS`) without a factory. The shape tool kit, `clipboardPreset` and `ingestPreset` include it. `useInsertDepSource` publishes the same dep on a host that builds its own.

<!-- entry: new api -->
