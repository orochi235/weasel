---
'@weasel-js/core': patch
---

`scene.applyBatch` threw `Cannot read properties of undefined` for any adapter-driven op, such as `createTransformOp`, while a journal opened with `scene.history.beginJournal` was the active one, and the edit never landed. Ops routed to a journal are now bound to the adapter passed at the call, as they already were on the scene's own undo stack.
