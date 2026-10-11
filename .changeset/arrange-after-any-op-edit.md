---
'@weasel-js/core': patch
'@weasel-js/history': patch
---

An op that gives a container its layout by calling `adapter.setLayout` itself now arranges the container in the same undo step, on a scene that had no layout before; only `createSetLayoutOp` did. `Op` gains `elideNoop`: an op carrying it is left out of the recorded entry when its first apply reports a no-op, which is how the scene's arrange op stays out of edits that needed no arranging.
