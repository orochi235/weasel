---
'@weasel-js/core': patch
---

A stroke of the weight tool can bend the path as it is painted. This is additive, with one breaking edge for anyone who wrote a `RigEditState` by hand.

- `RigEditState` now also holds the weights a stroke has painted and not yet written: `painted()` and `paint(next)`, with `listen` told of both. `createRigEditState()` makes one as before; an object written by hand to that interface needs the two new members.
- `useRigNode` takes `painting`, anything with `painted()` and `listen()` (the new `PaintedSkins` type). Give it the `RigEditState` the weight tool has and the rig binds the painted weights in place of each node's `data.skin` while the stroke runs, so a bent arm moves under the brush. Without `painting` a stroke shows on the path when it ends, as before.
- The document is still written once, as the stroke ends, and a canceled stroke leaves the rig on the document's weights.
