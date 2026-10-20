---
'@weasel-js/diagram': patch
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

`EffectEditor` takes `look`: `'nodeGraph'` (default), `'rack'`, or `'lanes'`, with that look's options. Under rack and lanes, connecting, reconnecting, and deleting work as under node graph, and a stage on the main line drags along it to another place, which rewires the pipeline (`'Reorder'`). Under lanes a lane drags by its label (`'Reorder lanes'`). `editorScene(doc, look, options)` replaces the node-graph-only signature, which is breaking for a caller that passed options second.

The effect model gains `chainLinks`, `moveInChain`, and `canMoveInChain`; `EffectDoc.laneOrder` with `setLaneOrder`; `laneTypeOf`; and `order` and `laneOrder` on `EffectLookResult`, which `rack` and `lanes` fill. `@weasel-js/diagram` adds `createSlotReorderAction`, `slotReorderContribution`, and `sequenceSlots`, which drag one item of any drawn sequence along its axis and draw an insertion bar. Core's overlay strokes and routing's `OverlayRole` add the `insert` and `refused` roles that bar draws in.
