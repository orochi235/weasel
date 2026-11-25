# Review saturation for `geom.tessellate`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the eleven files in the area's [Skulkr partition](docs/audits/partition.json#L3712). The partition was modified in the working tree. The passes shared context.

## Yield per review

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Polyline trim distances and vertex snapping | 1 | 1 | 0 |
| 2 | Fill contact, welding and translation invariance | 1 | 2 | 0 |
| 3 | Curve-to-polyline lookup, closing edges, and anchor parameters | 0 | 2 | 1 |
| 4 | Open versus closed contour selection, mesh grouping and stencil fallback | 0 | 2 | 2 |
| 5 | Crossing sweep ordering, contact handling, and degenerate rings | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

## Distinct defects

| ID | Finding | Location | First | Severity | Evidence |
|---|---|---|---:|---|---|
| T1 | Trimming a translated double-precision polyline can discard a substantial visible span | [trim.ts](packages/geom/src/tessellate/trim.ts#L50) | 1 | Medium | Executed |
| T2 | Translating a thin polygon can erase its fill even when all its coordinates stay representable | [crossings.ts](packages/geom/src/tessellate/crossings.ts#L167) | 2 | Medium | Executed |

- **T1.** Trim the open polyline with points at x=`1e9`, `1e9+100` and `1e9+200` and y=0 by 50 at each end. The output starts at `1e9+100` and ends at `1e9+150`, retaining 50 units instead of the requested 100. The cut is calculated correctly, then the world-coordinate-based Float32 tolerance treats it as the next vertex. This polyline stores numbers in double precision and the 50-unit separation is real.
- **T2.** Tessellate a closed polygon of width 256 and height 0.5, then translate its Float32 x coordinates from `[0, 256]` to `[1e9, 1e9+256]` with y unchanged. The origin case gives two triangles. The translated case gives zero triangles even though each coordinate and both extents remain exactly representable. A tolerance based on the absolute x offset marks the opposite horizontal edges as contacting and welds the 0.5-unit vertical extent away. The matching contact tolerance selects the resolver in the first place. [Contact test](packages/geom/src/tessellate/evenOdd.ts#L71)

The reproductions bundled the production modules in memory. Source and tests were left untouched.
