---
'@weasel-js/core': patch
---

Adds API: a pose override can carry a `path`. `scene.overrides.set(id, { pose, path })` makes the node paint and be picked by that path in place of the one in its data, with no document write, as an override's `pose` and `alpha` already work. `kit:path` and `kit:derived` nodes honor it, and an override path wins over a derived one. The path is in the frame a painter draws in, so give `pose` beside it as the path's bounds with no rotation. A view painting through its own `toPose` does not see it.
