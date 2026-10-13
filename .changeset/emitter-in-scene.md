---
'@weasel-js/core': patch
---

A scene subscriber that throws no longer stops the subscribers after it, or throws into the mutation that caused the notify. The scene's change notice, its selection, and `createPathEditState` now notify through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`. A subscriber added during a notify now waits for the next one; the scene used to call it in the same pass.
