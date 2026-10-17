---
'@weasel-js/diagram': patch
---

A custom `Path` outline is drawn in a unit square and stretched over its node's box, as a mark's path data is, so it follows its node when layout or a drag moves it. Breaking: a `Path` outline built in world coordinates now has to be rebuilt in the unit square.

`diagramScene` parses each drawn mark's `d` as it builds the scene and throws on path data that does not parse or draws nothing, naming the node and the mark's index, rather than painting a truncated path or nothing at first paint.

`DiagramView` fits its view again when `width`, `height` or a fit option (`minScale`, `maxScale`, `anchor`, `fitPadding`) changes, as long as the view is still the fit it last applied; once the user pans or zooms, a resize leaves the view where they put it. The refit reaches `onViewChange`.
