---
"@weasel-js/core": patch
"@weasel-js/diagram": patch
---

Connectors can jump each other. While a scene's `HOPS_DOC_KEY` document value is set, wherever two
connectors cross, the one later in render order bows over the other in a half circle of the value's
`size`. A hop bulges toward −y on a horizontal run and toward −x on a vertical one, whichever way the
connector travels, and to the left of travel on a diagonal. Crossings near either connector's ends
or a bend, and collinear overlaps, make no hop, and hops closer than twice their radius merge into
one longer hop. Each connector stores its hops as `diagram.hops`, so a saved file draws them with no
pass running, and a hop no longer on its connector's route does not draw.

`useHops(scene)` (or `installHops` outside React) recomputes the hops an edit disturbed in that
edit's own undo entry, and turning the value on or off recomputes or clears them all in the one
entry that sets it. While a drag is in progress, the connectors it moves, and those hopping over
them, draw without hops until release. `diagramWaypoints` carries a Line jumps toggle
(`SET_HOPS_ACTION_ID`), `DiagramView` takes `hops`, a radius, and `edgeHops`, the crossing finder
over plain polylines, is in `@weasel-js/diagram/layout`.

Core's `TransformFollower.preview` gets a second argument: the data the followers before it
previewed, by id, so a follower can build on a route an earlier one previewed. A follower that
calls `preview` itself now passes it.

weaselchart adds Format › Connector › Line jumps.
