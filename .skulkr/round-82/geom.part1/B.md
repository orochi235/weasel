# Audit round 82, geom.part1 — findings

## segmentCrossings misses every touch and overlap between a straight curve and a collinear line (or another straight curve)
- where: packages/geom/src/intersect/segmentIntersections.ts:189 (segmentCrossings, flat-piece branch) with chordCross at :86
- scenario: `segmentCrossings([{x:0,y:0},{x:0,y:0},{x:10,y:0},{x:10,y:0}], [{x:10,y:0},{x:20,y:0}])` — a cubic with retracted handles (a straight cubic, which "convert to curve" and retracted-handle anchors produce routinely) meeting a line end to end along its own line. Both pieces have flatness 0 at depth 0, so the loop goes straight to `chordCross`, whose chords are exactly parallel (`den === 0`), and it returns null: the result is `[]`. The same pair given as two lines goes through `collinearOverlap` and answers the touch `{ta:1, tb:0, x:10, y:0}`; a partial overlap (cubic (5,0)…(15,0) on line (0,0)–(10,0)) likewise answers nothing as a curve and the two overlap ends as a line. The doc promises that overlapping segments "report at most `maxHits` points of the stretch". So `pathCrossings`/`crossingStops` (and through them `snipPathAt` and path snapping) miss a cutter touching or lying along a straight curved segment, depending only on whether a segment is stored as `C` or `L`. The flat-piece branch should fall back to `collinearOverlap` on the two chords when they are (nearly) parallel, as the line–line branch does.
- evidence: read
- severity: medium

## A LengthRun control list of more than two control points (or not a multiple of `dim`) is silently mis-measured and mis-evaluated
- where: packages/geom/src/along/bezier.ts:7 (bezierPoint), packages/geom/src/along/arcLookup.ts:36 (derivative), packages/geom/src/along/lengthTable.ts:24 (LengthRun.controls doc)
- scenario: `lengthTable([{ points: [0,0, 10,0], closed: false, controls: [[2,5, 4,5, 6,5]] }], 2)` — the public `LengthRun.controls` doc says only "the control points of the curve between them, `dim` components each", with no degree limit. Three controls make n = 4: `bezierPoint` falls to its `else` (line) branch and lerps from the start to the *first control point*, `derivative` treats it as a cubic of its first four points, and `segmentLength` (paths/segmentLength.ts) likewise reads only the first three differences. `pointAtLength` then answers points that are not on any curve through those controls, with no error. A control list whose length is not a multiple of `dim` gives a fractional n and the same silent misreading. Either reject/throw on n > 3 or non-integral n in `lengthTable`, or state the limit on the public type.
- evidence: read
- severity: low

## Files read
packages/geom/src/3d/along3.ts
packages/geom/src/3d/index.ts
packages/geom/src/3d/mat4.ts
packages/geom/src/3d/portCurve3.ts
packages/geom/src/3d/ray3.ts
packages/geom/src/3d/vec3.ts
packages/geom/src/affine.ts
packages/geom/src/affineFit.ts
packages/geom/src/along/along.bench.ts
packages/geom/src/along/arcLookup.ts
packages/geom/src/along/bezier.ts
packages/geom/src/along/curvePosition.ts
packages/geom/src/along/lengthTable.ts
packages/geom/src/along/pathTable.ts
packages/geom/src/along/positions.ts
packages/geom/src/angle.ts
packages/geom/src/box.ts
packages/geom/src/bvh/bvh.ts
packages/geom/src/bvh/bvhQuery.ts
packages/geom/src/bvh/bvhTree.ts
packages/geom/src/bvh/settledCache.ts
packages/geom/src/commands.ts
packages/geom/src/curve.ts
packages/geom/src/curves/anchorHandles.ts
packages/geom/src/curves/bezierCubic.ts
packages/geom/src/curves/bezierQuadratic.ts
packages/geom/src/curves/curvatureSource.ts
packages/geom/src/curves/index.ts
packages/geom/src/curves/nurbs.ts
packages/geom/src/curves/spiro.ts
packages/geom/src/curves/types.ts
packages/geom/src/easingSpec.ts
packages/geom/src/easings.ts
packages/geom/src/flatten.ts
packages/geom/src/glMat3.ts
packages/geom/src/index.ts
packages/geom/src/intersect/pathCrossings.ts
packages/geom/src/intersect/pathSegments.ts
packages/geom/src/intersect/segmentIntersections.ts
packages/geom/src/intersect/writeSubpaths.ts
packages/geom/src/meanScale.ts
packages/geom/src/nd/index.ts

<!-- done: 2 findings, files read: 42 -->
