---
'@weasel-js/core': patch
---

Each piece of a Divide or a Crop stands in for its own source. `applyBooleanOp` hands `createPathNode` the topmost source a piece was cut from, where it passed the topmost selected one for every piece, so a Crop's pieces no longer take the mask's paint and parent. A `paint` argument is that source's too.

Results are placed per parent: those whose sources share a parent land as one block in the slot of the topmost source there. A selection inside one parent lands where it did before.

Behavior change for a `BooleansAdapter`: `createPathNode`'s `sourceId` varies between the pieces of one call. An adapter that painted every result from the topmost selected node should read `sourceId`.
