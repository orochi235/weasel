---
'@weasel-js/core': patch
'@weasel-js/geom': patch
---

The path data model, the pure math over it, and the easing curves moved from `@weasel-js/core` into `@weasel-js/geom`. Core re-exports every name it exported before, so code importing from `@weasel-js/core` or `@weasel-js/core/math` needs no change.

`@weasel-js/geom` now exports `Path`, `PolygonPath`, `RectPath` and `PathFillRule`; the builders (`PathBuilder`, `rectPath`, `ellipsePath`, `polygonFromPoints` and the rest); `pathFromD`, `boundsOfPath`, `unionBoundsPath`, `translatePath`, `scalePathToBounds`, `transformPath`, `composePath`, `decomposePath`, `splitSubpaths`, `pointAlongPath`, `pathDistanceToPoint`, `splitCubicAtT`, `fitCubicThroughDeletion`, `cubicPointAt`, `schneiderFit` and the `Point` type; and every easing curve with `EASINGS`, `SPRING_PRESETS`, `cubicBezierEasing` and `resolveEasing`. Three subpaths are new or grow: `@weasel-js/geom/curves` (Bezier, NURBS and Spiro representations, `CURVE_REPS`), `@weasel-js/geom/tessellate` (`tessellate`, `extractPolylines`, `trimPolyline`, the `Mesh` type), and `@weasel-js/geom/booleans`, which adds `splitPathBySegment`, `splitPathByPolyline` and `snipPathByPolyline`. `earcut` is a new optional peer of geom, needed only by `./tessellate`.

Breaking for direct `@weasel-js/geom` users: `GeomPath` and `GeomPolygonPath` are gone, replaced by `Path` and `PolygonPath`. Hit-testing and booleans now take the typed-array `Path` — `commands` a `Uint8Array`, `coords` a `Float32Array`, `fillRule` required — rather than any array-like.
