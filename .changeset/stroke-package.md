---
'@weasel-js/stroke': patch
'@weasel-js/core': patch
---

stroke: a new package holding a stroke as geometry, moved out of core. `tessellateStroke` and `resolveStrokeWidth` build the ribbon mesh; `registerMarker`, `getMarker`, `listMarkers`, `markerRegistry`, `markerGeneration`, and `BUILTIN_MARKERS` are the marker registry; `markerSites`, `markerHeads`, `markerInset`, `markerKeyOf`, `resolveMarkerSize`, `strokeInsets`, and `markerReach` place and measure marker heads; `strokeToPath` outlines the whole stroke as a path. It depends on `@weasel-js/geom`, `@weasel-js/paint`, and `@weasel-js/registry`, and has no scene and no React.

The stroke metric functions the renderer uses are exported here too (`strokeSpaceOf`, `polylineIntoMetric`, `coordsOutOfMetric`, and the rest, with `StrokeMetric`, `ScreenSpace`, and `StrokeSpaces`), as are `splitForDash`, `populatePolylineWidths`, `trimInSpace`, `markerHeads`, `markerReadsKey`, and `markerReach`. These were not exports of `@weasel-js/core` before; they are additions. `_resetMarkersForTests` is at `@weasel-js/stroke/test-seams`.

`@weasel-js/core` still exports every name it did before.
