---
'@weasel-js/diagram': patch
---

A custom `Path` outline is drawn in a unit square and stretched over its node's box, as a mark's path data is, so it follows its node when layout or a drag moves it. Breaking: a `Path` outline built in world coordinates now has to be rebuilt in the unit square.

`diagramScene` parses each drawn mark's `d` as it builds the scene and throws on path data that does not parse or draws nothing, naming the node and the mark's index, rather than painting a truncated path or nothing at first paint.

`DiagramView` fits its view again when `width`, `height` or a fit option (`minScale`, `maxScale`, `anchor`, `fitPadding`) changes, as long as the view is still the fit it last applied; once the user pans or zooms, a resize leaves the view where they put it. The refit reaches `onViewChange`.

`DiagramView`'s `onMove` takes a second argument: every edge whose route a layout run rewrote, as `EdgeRoute` (`{ id, waypoints }`, with `id` the edge's `edgeIdOf` and `waypoints` empty when the run left it straight). Stored as the data edge's new `routed` field, a route survives the data being laid into a scene again and stays layout's to replace; `waypoints` still means the author's own route.
