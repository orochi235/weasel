# Review saturation for `geom.booleans`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 32 files in the [Skulkr partition](docs/audits/partition.json#L3481), which was modified in the working tree. The passes shared context and followed the public operations through their main implementation paths.

## Yield per review

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Boolean dispatch, fast paths and piece grouping | 1 | 1 | 0 |
| 2 | Knife and scissors command output, subpath policy and metadata | 1 | 2 | 0 |
| 3 | Polygon adapter, input origins and ring fill | 1 | 3 | 0 |
| 4 | Crossings, tangencies and coincident curve segments | 0 | 3 | 1 |
| 5 | Arrangement labeling, face nesting and adjacency | 0 | 3 | 2 |
| 6 | Triangle coverage, mesh junctions and boundary fallback | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

## Distinct defects

| ID | Finding | Location | First | Severity | Evidence |
|---|---|---|---:|---|---|
| B1 | Merge unites inputs tagged with NaN despite documenting strict equality | [ops.ts](packages/geom/src/booleans/ops.ts#L210) | 1 | Low | Executed |
| B2 | Snipping can give an intentionally unfilled open contour a fill | [splitBySegment.ts](packages/geom/src/booleans/splitBySegment.ts#L182) | 2 | Medium | Executed |
| B3 | The polygon adapter can collapse rebased geometry when converting its coordinates to world doubles | [adapter.ts](packages/geom/src/booleans/adapter.ts#L66) | 3 | Low | Executed |

- **B1.** Call `pathMerge` on two disjoint visible rectangles with `() => NaN` as the grouping function. It emits one piece with sources `[0,1]`. The public contract says keys compare with `===`, under which the results are unequal. Both the flattened and curve-preserving grouping use `Map`, which groups NaN keys together. [Curved grouping](packages/geom/src/booleans/curvePieces.ts#L38)
- **B2.** Snip an open L-shaped path whose `openFill` is explicitly `'none'`. The emitted pieces have `openFill: undefined`. Under the default closing policy a remainder containing the bend can acquire a filled triangle. The same write path reconstructs uncut subpaths, so a cut on one contour can change fill behavior on another. [Path writer](packages/geom/src/booleans/cutRegions.ts#L29)
- **B3.** Give `pathToMultiPolygon` a unit square in local coordinates with x origin `2 ** 54`. The path can store the unit width in its separate local coordinate stream. The conversion adds the origin to each x before handing it to the clipper, so both sides of the unit square have the same x. The resulting ring is degenerate. This limits operations using the world-coordinate adapter even when the inputs share a usable local frame.

The probes bundled production modules in memory. Source and tests were left untouched.
