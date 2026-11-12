---
'@weasel-js/core': patch
---

An `inPlane` action's `onMove` and `onEnd` are handed the dispatcher's empty deps on a parallax layer too, as `InvocationCtx.deps` says.

Read deps in `start` and keep what the gesture needs; a move never carries them.

<!-- entry: fix -->
