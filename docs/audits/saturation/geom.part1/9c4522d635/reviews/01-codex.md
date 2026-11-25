# Review saturation for `geom.part1`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 42 files in the [Skulkr partition](docs/audits/partition.json#L3533), which was modified in the working tree. The passes shared context and focused on the contracts and paths named below.

## Yield per review

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Affine transforms, fitting and numeric conditioning | 2 | 2 | 0 |
| 2 | Scale aggregation and round trips through the math helpers | 1 | 3 | 0 |
| 3 | Easing inverse and progress near flat Bézier endpoints | 1 | 4 | 0 |
| 4 | BVH queries, traversal scratch and deferred caching | 0 | 4 | 1 |
| 5 | Length tables, curve stops and crossing endpoint handling | 0 | 4 | 2 |
| 6 | 3D ray boundaries and empty or degenerate curve inputs | 0 | 4 | 3 |

Stopped after three consecutive passes with zero new defects.

## Distinct defects

| ID | Finding | Location | First | Severity | Evidence |
|---|---|---|---:|---|---|
| G1 | A finite, well-conditioned uniform scale can produce a zero inverse matrix | [affine.ts](packages/geom/src/affine.ts#L54) | 1 | Low | Executed |
| G2 | An affine fit can reject distinct points after a common translation | [affineFit.ts](packages/geom/src/affineFit.ts#L27) | 1 | Medium | Executed |
| G3 | The geometric mean of finite scales can overflow even when the correct mean is finite | [meanScale.ts](packages/geom/src/meanScale.ts#L16) | 2 | Low | Executed |
| G4 | A valid cubic Bézier easing can return progress orders of magnitude too small near a flat x endpoint | [easingSpec.ts](packages/geom/src/easingSpec.ts#L48) | 3 | Low | Executed |

- **G1.** Invert `[1e200, 0, 0, 1e200, 0, 0]`. The determinant overflows and its reciprocal becomes zero. Conditioning is checked using this zero candidate, which passes, so the method returns a zero linear matrix instead of the representable inverse with scale `1e-200`.
- **G2.** Fit `[1e13, 0, 1e13+1, 0]` to itself. The two x coordinates are distinct and their centered difference is exactly representable. The function returns null because its spread check compares against the square of the absolute centroid. Fitting the same pair at the origin gives the identity similarity.
- **G3.** `meanScale({ x: 1e200, y: 1e200 })` returns infinity because the intermediate product overflows. A camera with equal finite scale on both axes should report that scale. Very small equal scales can underflow by the same mechanism.
- **G4.** `cubicBezierEasing(0, 1, 0, 1)(1e-8)` returns roughly `3e-8`. For this valid curve x is the cube of the curve parameter, so y at that x is about 0.00644939. The absolute x error threshold accepts the initial guess even though the y error is substantial.

The probes bundled production modules in memory. Source and tests were left untouched.
