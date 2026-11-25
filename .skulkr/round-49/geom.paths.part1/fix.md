fixed cfcfb3686f | `pathToAnchors` reused a quadratic's control point as both cubic handles, so editing any anchor bulged the path's `Q` segments (A). It now converts each quadratic to the cubic that traces the same curve. `heldBy` reads the quadratics without converting them, so both handles still map to the control point (`[0, 1, 1, 2]` still holds).
fixed 0615f77c84 | `offsetCornerTraces` read a convex `square` corner as concave, so its trace moved inward and the offset lost the corner (A). It now tests convexity against the outline with every corner left sharp, which works for any corner shape. Added tests for convex and concave corners.
fixed 5566fdfd98 | `isAnchorSmooth` counted two handles pointing the same way as smooth, so fairing, handle drags and bends altered cusps (B). It now also requires the handles to point opposite ways (negative dot product).
fixed de0e1ac69a | `growRegion`'s round join bent a U-turn cap back into the shape, depending on which way rounding tipped a near-zero cross product (B). A U-turn's arc now always turns outward.
fixed 09dc43fefd | `growRegion` used one winding sign for the whole path, so a separate shape wound the other way shrank instead of growing (B). Each contour now finds its outside by testing the winding number on both sides of it (new `contourSides.ts`). If neither side or both sides are unfilled, it falls back to the path's sign. Holes still shrink.
fixed 53eaab0ee0 | `flatAnchorIndices` started a subpath opened without an `M` at the wrong point, so every later anchor's index was one too high (B). It now starts that subpath at the pen position. A closing curve that folds onto that uncounted start reads -1, and `carryCorners` and `restoreCorners` skip it.

Each fix has its own commit and changeset.

Checks:
- Every test file I touched or affected: pass. Each was run alone with `--maxWorkers=1`: anchors, anchorOrigins, cornerOffset, fairing, growRegion, cornerCarry, cornerRestore, corners.survival, mergeRegion, pathOriginReaders, anchorSymmetry, anchorSymmetry.group, bendSegment, handleEdits, poiseHandles, path-tools `anchorHandles`, stroke `offsetPath`, pdf `textOps`.
- One accidental run: an empty `xargs` started a bare vitest run of everything. I stopped it partway; it did not change any files.
- `npm run checks:gate`: pass, 32/32. The first run failed `npm run lint` on 5 `weasel/no-hand-lerp` errors in my own code; I fixed them with `lerp` and folded the fixes into the original commits.
- `npm run check:changesets`: pass ("OK — 2396 changeset(s)").
- `npm run lint -w @weasel-js/geom`: not run, because geom has no lint script ("Missing script"). The root `lint` inside the gate covers its files and passed.
- Tree clean; `.skulk/` untouched.

tally: 6 of 6 fixed, 0 extra fixed