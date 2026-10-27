---
'@weasel-js/routing': patch
---

Adds API: while an OS drag hovers a canvas, the dispatcher asks the action its drop would run for its `Action.preview`, with the params the drop would bring (the drag's items, `via: 'drop'`, `worldX`/`worldY`), and takes the preview down when the drag moves, leaves, drops or the canvas unmounts. A drag that sits still is asked once.

The items `itemTypesFromDataTransfer` returns now carry `pending: 'file' | 'string'` beside their MIME, read with the new `pendingKindOf`; the type `PendingIngestItem` names that shape.
