---
'@weasel-js/core': patch
---

Core's local `{ x: number; y: number }` point types are geom's `Point` now, or `WorldPoint` where the point is the dispatcher's. `DragRectPoint`, `DragRadialPoint`, `PolygonPoint`, `StarPoint` and `LinePoint` are aliases of `WorldPoint`, and `MeasurePoint` of `Point`, in place of interfaces of their own. They have the same shape, so nothing that type-checked before stops.
