---
'@weasel-js/core': patch
---

The points the snap, paths, edit-anchors and `group.enter` code takes from the pointer are typed `WorldPoint`: the `geometryAt` that `sceneSession2d` and `sceneProbeReads` take, `ownGeometryAt`, `AngleCollect.pivot` and `press`, `PathEditDrag.handle`, `PathRepresentation.segmentPress` and the point `worldToScreen` takes. `WorldPoint` is an alias of `Point2`, so nothing that type-checked before stops.
