---
'@weasel-js/core': patch
---

`moveNodes(deps, ids, { dx, dy }, label?)` moves nodes the way a drag of them commits: derived nodes through what they derive from, every descendant not carried by a moving frame, each translated in the frame it is stored in, finished by the `transformFollowers` and committed as one undo entry (inside an open `scene.batch`, as part of it). `moveNodesOps` builds the same ops without committing them, and `MOVE_NODES_REQUIRES` names the deps an action calling `moveNodes` declares. The move action, nudge, Transform Again and the measure tool's Move By all build their translate ops through it.

The ingest action now also requires `poseDescriptor`, `geometryProjection` and `transformFollowers`, so a content handler can move what it inserts with `moveNodes(ctx.deps, …)`.
