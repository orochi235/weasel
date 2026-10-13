---
'@weasel-js/core': patch
---

A behavior can do frame math. `GestureContext.frames` (`GestureFrames<TPose>`, new) takes a pose between the frame a node stores it in and world: `toWorld(id, pose)`, `toLocal(id, worldPose)`, `world(id)` for the pose the scene shows now, and `planeOf(layer)` for the parallax plane a layer is stored in. Move, resize, rotate, and clone set it; an insert and a lasso, whose poses belong to no node, leave it absent.

A move's `ctx.current` is the pose each dragged node would store, so `frames.toWorld(id, ctx.current.get(id))` is where it is in world. It used to be the stored pose shifted by the world drag, which is a different value for a node inside a turned or scaled frame, and a node carried by a frame that is itself dragged now reads its unchanged stored pose. Under the default composition, where stored and world are one value, nothing changes.
