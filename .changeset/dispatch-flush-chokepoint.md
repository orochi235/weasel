---
'@weasel-js/core': patch
---

The renderer's solid batch is drained at the sites that decide routing or
change stencil state, instead of at each emitter that happened to remember.
Geometry that cannot join a run now goes through `tryStageSolid`, which returns
`false` only after flushing — so the only way an emitter earns permission to
draw for itself is to have called the function that drained the batch. `pushClip`
and `popClip` flush as their first statement, since rasterizing into the stencil
is what creates the obligation.

Nothing about the drawn result changes; this removes a way for a future draw
path to paint under geometry staged before it.
