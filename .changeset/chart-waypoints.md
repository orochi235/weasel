---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

Connector routes are editable, and whole-node transforms carry other nodes along through one dep.

- core: a `transformFollowers` dep holds every `TransformFollower`, `{ preview(frame), finish(ops, label) }`, and each whole-node transform (move, resize, rotate, flip, align, distribute, nudge, transform again) finishes its batch and previews its frame through all of them in order. `useTransformFollower` adds one. Path edit's constraint links are now one of them, so `EditAnchorsDep.transformOps` and `EditAnchorsDep.transformPreview` are gone; that is breaking for anyone who called them. `writtenBy(scene, ops)` reads the pose and data a batch leaves each node it writes.
- diagram: a selected edge shows handles along its route. Under `straight` and `bezier`, a dot on each waypoint moves it and a hollow dot in each leg inserts one; under `orthogonal`, a bar slides its segment, jogging where it touches a port. A double-click removes a waypoint or straightens a jog. Drags snap into line with neighboring stops and port axes. `diagramWaypoints` returns the handle layer and a contribution carrying the drag, the double-click, and the `diagram.resetRoute` command; the math is exported on its own (`routeHandles`, `dragSegment`, `simplifyStops`, and the rest). `waypointFollower(scene)` carries waypoints along with a move of both ends. `DiagramView` takes `onEditRoute`, and `EffectEditor` keeps wire routes in `EffectDoc.routes` (`setWireRoute`). `edgeRouter` answers an edge's resolved route, as `edgeDerivePath` draws it.
