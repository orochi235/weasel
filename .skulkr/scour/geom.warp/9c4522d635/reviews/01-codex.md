# Review saturation for `geom.warp`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 18 files in the [Skulkr partition](docs/audits/partition.json#L3728), which was modified in the working tree. The passes shared context.

## Yield per review

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Refitting sampled curves and tolerance | 1 | 1 | 0 |
| 2 | Cloth dimensions, quad and control entry points | 1 | 2 | 0 |
| 3 | Pin-map inversion and large coordinates | 1 | 3 | 0 |
| 4 | Pin targets, cache identity and disconnected pieces | 0 | 3 | 1 |
| 5 | Mesh location, barycentric placement and refinement | 0 | 3 | 2 |
| 6 | ARAP factorization, bounded iteration and fold handling | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

## Distinct defects

| ID | Finding | Location | First | Severity | Evidence |
|---|---|---|---:|---|---|
| W1 | Adaptive warp sampling can miss a localized bend by many times the requested tolerance | [warpPath.ts](packages/geom/src/warp/warpPath.ts#L89) | 1 | Medium | Executed |
| W2 | A non-finite cloth dimension yields an empty grid or an unbounded generation loop | [mesh.ts](packages/geom/src/warp/mesh.ts#L29) | 2 | Medium | NaN executed, infinity source-traced |
| W3 | A large x offset can make pin-map inversion fail along an independent y axis | [pinWarp.ts](packages/geom/src/warp/pinWarp.ts#L145) | 3 | Medium | Executed |

- **W1.** Warp the line from `(0,0)` to `(1,0)` at tolerance 0.5 using a map that keeps x and adds `10*(1-z*z)**2` to y for `abs(z)<1`, with `z=(x-0.03125)/0.02`. The bend is between the sampled endpoints and midpoint. The fit returns the original line even though the warped curve reaches y=10. The exported tolerance is described as a bound on deviation, but samples that miss a feature cannot enforce it.
- **W2.** `meshGridOver(box, NaN, 1)` returns a grid with `rows: NaN` and no points. The downstream interpolator expects a rectangular array of control points. With positive infinity the row or column loop lacks a finite endpoint, so the constructor can exhaust resources while appending points. Both values pass through the round-and-lower-bound operation.
- **W3.** Invert `(x,y) → (x,y+y³)` at target `(1e12,10)` with the default guess and tolerance. The returned y is about 10, whose mapped y is about 1010. The y finite difference spans a million units even though the large coordinate is x and the axes are independent. That inflated derivative makes each update too small to approach the actual inverse within the iteration cap.

The probes bundled production modules in memory. Source and tests were left untouched.
