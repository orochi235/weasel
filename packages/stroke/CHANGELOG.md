# @weasel-js/stroke

## 1.10.2

### Patch Changes

- Updated dependencies [5338358]
- Updated dependencies [765cd31]
- Updated dependencies [616a4b2]
- Updated dependencies [9073669]
  - @weasel-js/geom@1.10.2
  - @weasel-js/paint@1.10.2
  - @weasel-js/registry@1.10.2

## 1.10.1

### Patch Changes

- cbd5b4d: `@weasel-js/geom`'s six-number affine type is `Affine`, no longer `Mat3`. It sat one capital letter from `mat3`, the namespace over the nine-element column-major `GlMat3` a GL uniform takes, and the two are different matrices. `mat3.toAffine` and `mat3.fromAffine` already named the conversion this way.
  
  Breaking: `import type { Mat3 } from '@weasel-js/geom'` becomes `import type { Affine }`. The values are unchanged, and so are the free functions beside the type (`identity`, `multiply`, `invert`, and the rest).
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- d8b51a4: Geometry for the path commands. `simplifyPath(path, tolerance)` refits a path with as few anchors as hold it within the tolerance, keeping corners, the ends of open subpaths, and long flats between curves. `snipPathsAtCrossings(paths)` (in `@weasel-js/geom/booleans`) cuts each path's stroke wherever another of them crosses it. `averageAnchorsAt` moves anchors to their mean position on one or both axes, and `joinAnchorsAt` / `joinSubpathEnds` join two open-subpath ends, closing a subpath or merging two, with `subpathEndAt` and `closestOpenEnds` to find them. In `@weasel-js/stroke`, `offsetPath(path, distance)` grows or shrinks the region a path fills, taking a stroke's miter, round, or bevel joins, and refits the result as curves.
- ab9ea7a: A stroke more than twice as wide as the flatten tolerance now flattens its curves in steps of at most 10°. Before, a tight bend under a thick stroke took steps of 40° or more and showed visible facets on the stroke's edges. Thinner strokes still flatten on the same vertices as their fill. `extractPolylines` takes a new `maxTurn` option, and `flattenCubicWithArcLen` and `flattenQuadraticWithArcLen` take a trailing `maxTurn` argument.
- Updated dependencies [cbd5b4d]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [ee59ccd]
- Updated dependencies [9eefcc7]
- Updated dependencies [886380f]
- Updated dependencies [d8b51a4]
- Updated dependencies [62e766c]
- Updated dependencies [ab9ea7a]
- Updated dependencies [e962494]
  - @weasel-js/geom@1.10.1
  - @weasel-js/paint@1.10.1
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- 9c19d5e: stroke: a new package holding a stroke as geometry, moved out of core. `tessellateStroke` and `resolveStrokeWidth` build the ribbon mesh; `registerMarker`, `getMarker`, `listMarkers`, `markerRegistry`, `markerGeneration`, and `BUILTIN_MARKERS` are the marker registry; `markerSites`, `markerHeads`, `markerInset`, `markerKeyOf`, `resolveMarkerSize`, `strokeInsets`, and `markerReach` place and measure marker heads; `strokeToPath` outlines the whole stroke as a path. It depends on `@weasel-js/geom`, `@weasel-js/paint`, and `@weasel-js/registry`, and has no scene and no React.
  
  The stroke metric functions the renderer uses are exported here too (`strokeSpaceOf`, `polylineIntoMetric`, `coordsOutOfMetric`, and the rest, with `StrokeMetric`, `ScreenSpace`, and `StrokeSpaces`), as are `splitForDash`, `populatePolylineWidths`, `trimInSpace`, `markerHeads`, `markerReadsKey`, and `markerReach`. These were not exports of `@weasel-js/core` before; they are additions. `_resetMarkersForTests` is at `@weasel-js/stroke/test-seams`.
  
  `@weasel-js/core` still exports every name it did before.
- bf9a262: Adds API: `strokeToPath`'s options take `frame`, the matrix from the frame a stroke is drawn in to the path's coordinates. The outline is built in that frame and carried back through it, so a stroke under a pose `transform` comes out skewed or stretched the way the canvas draws it, and a `{ px }` width under a view that scales each axis apart holds its thickness on screen when the frame is the inverse of the view's scale. A frame that cannot be inverted gives an empty path. Nothing in core passes it yet.
- Updated dependencies [a86d79f]
- Updated dependencies [1837952]
- Updated dependencies [126116b]
- Updated dependencies [b1f7521]
- Updated dependencies [18547a3]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [b260415]
- Updated dependencies [54174b6]
- Updated dependencies [4edad85]
- Updated dependencies [335f192]
- Updated dependencies [7b9de2d]
- Updated dependencies [ea54a64]
- Updated dependencies [955defa]
- Updated dependencies [27b827e]
- Updated dependencies [ee08fa5]
- Updated dependencies [54242f0]
- Updated dependencies [46fcc7e]
- Updated dependencies [a297730]
  - @weasel-js/geom@1.10.0
  - @weasel-js/paint@1.10.0
  - @weasel-js/registry@1.10.0
