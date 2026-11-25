# Review saturation for `geom.part2`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 41 files listed in the [Skulkr partition](docs/audits/partition.json#L3580), which was modified in the working tree. The passes shared context and focused on the paths named below.

## Yield per review

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Typed-array serialization and JSON object semantics | 1 | 1 | 0 |
| 2 | Track slicing, direction and empty spans | 1 | 2 | 0 |
| 3 | Nearest-point distance ranking and curve roots | 1 | 3 | 0 |
| 4 | View projection and pixel-distance predicates | 1 | 4 | 0 |
| 5 | Placement, output grids and intervals | 0 | 4 | 1 |
| 6 | Flat and path snap queries and result selection | 0 | 4 | 2 |
| 7 | Spline sampling, track placement and frame composition | 0 | 4 | 3 |

Stopped after three consecutive passes with zero new defects.

## Distinct defects

| ID | Finding | Location | First | Severity | Evidence |
|---|---|---|---:|---|---|
| H1 | A JSON-compatible object that returns itself from `toJSON` overflows the tagger stack | [typedArrayJson.ts](packages/geom/src/typedArrayJson.ts#L126) | 1 | Medium | Executed |
| H2 | A zero-length arc or ellipse slice loses its location on the curve | [track/slice.ts](packages/geom/src/track/slice.ts#L21) | 2 | Medium | Arc executed, ellipse traced |
| H3 | Squared-distance overflow makes cubic nearest-point search return the wrong point | [nearest.ts](packages/geom/src/nearest.ts#L62) | 3 | Low | Executed |
| H4 | A squared pixel-radius comparison can accept an outside point | [pxExtent.ts](packages/geom/src/pxExtent.ts#L74) | 4 | Low | Executed |

- **H1.** `JSON.stringify({ x: 1, toJSON() { return this } })` produces `{"x":1}`. Passing that object to `tagTypedArrays` throws `RangeError`. The tagger reprocesses the replacement as the same property and invokes `toJSON` again indefinitely. A serializer that follows JSON's property semantics invokes the method once per property before traversing the result.
- **H2.** Slice a radius-10 arc centered at the origin, spanning 0 to 90 degrees, from 0.5 to 0.5. The original midpoint is approximately `(7.071,-7.071)`. The slice's only point is `(0,0)`. The arc and ellipse special cases construct a zero-radius shape at the original center, while the line and generic paths keep their collapsed interval at the selected station.
- **H3.** Query `(2e160,1e160)` against a straight cubic with x coordinates `[0,1e160,2e160,3e160]` and zero y coordinates. The nearest point is at x=`2e160`. The routine reports the start, at distance about `2.236e160`. Squared distances overflow even though distances and coordinates are representable. The competing candidates all compare as infinity.
- **H4.** `withinPxRadius(2e160, 0, 1e160, {x:1,y:1})` returns true. Both squares overflow, so the comparison is infinity against infinity. The screen-space displacement is twice the radius.

The probes bundled production modules in memory. Source and tests were left untouched.
