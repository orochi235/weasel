---
"@weasel-js/kernel3d": patch
---

`createInsert` takes a `viewId`, as the other dep factories do, and casts a drag through that view's camera. It used to ask its `viewport` source for the surface's camera alone, so an insert dep handed to a second 3D view's `<CanvasView deps>` laid its footprint where the first camera's ray met the ground.
