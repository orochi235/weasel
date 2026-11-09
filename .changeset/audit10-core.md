---
'@weasel-js/core': patch
---

Edits that change nothing leave no undo entry.

- `createMoveToIndexOp` and `createSetChildOrderOp` report a no-op when the order they would write is the order the parent already has, so a layer-list drop onto a row's own slot adds no undo step.
- `createSetHiddenOp`, `createSetLockedOp`, `createSetLayerOp`, `createSetDataOp`, `createSetDependsOnOp` and `createTransformOp`, applied through an adapter with `getNode`, report a no-op when the node already holds what they write. Before, `applyBatch` recorded each as an undo entry that did nothing, since the scene write under it recorded nothing.
- `scene.move` to the parent and slot a node already has, and `scene.reorder` to the index it already has (or past the end it already sits at), record nothing.
- `scene.setLayerParallax` with a factor equal to the layer's own, though a different object, records nothing.
