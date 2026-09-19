---
'@weasel-js/svg': patch
---

`parseSvg` now reads a document's own `<marker>` when a stroke references one the marker registry has no entry for, instead of warning and dropping it. The new `ParseResult.markers` holds a `MarkerEntry` for each: its geometry and paint, `refX` / `refY` as the anchor, the viewBox, `markerWidth` / `markerHeight` and `markerUnits` folded into the size, and `orient` as the orientation (`context-stroke` reads as the line's own paint). Keys are the marker's id plus a hash of what it draws, so two files with the same id never collide, and the strokes in `nodes` name those keys. Nothing draws them until they are registered; `unpackSvgFiles` registers them itself. A reference the document does not define still warns and is dropped.

A marker def written on export now keeps its entry's solid fill and outline colors and a fixed `orient`, where it used to write every marker as `context-stroke` pointing `auto`. It writes `orient="auto-start-reverse"` rather than `auto`, because weasel turns every start marker around, and a start arrowhead in another viewer used to point back into its line.
