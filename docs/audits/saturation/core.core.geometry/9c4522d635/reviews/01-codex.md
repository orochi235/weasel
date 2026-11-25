# Review saturation for `core.core.geometry`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 12 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Descriptor rotation, bounds and effective frames | 1 | 1 | 0 |
| 2 | Region edge contact and fast rejection | 1 | 2 | 0 |
| 3 | Finite union inputs and representable results | 1 | 3 | 0 |
| 4 | Pose remapping, flips and translation fallbacks | 0 | 3 | 1 |
| 5 | Target inverses, ink extents and rotated rectangle tests | 0 | 3 | 2 |
| 6 | Boolean dispatch, path descriptors and vector projections | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| G1 | An explicit descriptor rotation of zero can leave the bounds' old rotation in effect | [poseDescriptor.ts](packages/core/src/core/geometry/poseDescriptor.ts#L265) | 1 | Medium | Source-traced |
| G2 | The coarse box rejects an exact boundary contact before outline intersection is tested | [regionHit.ts](packages/core/src/core/geometry/regionHit.ts#L121) | 2 | Low | Source-traced |
| G3 | Two finite boxes can produce an infinite union extent | [unionBounds.ts](packages/core/src/core/geometry/unionBounds.ts#L127) | 3 | Low | Source-traced |

- **G1.** Supply a descriptor whose `getBounds` retains `rotation: Math.PI/2` and whose `getRotation` returns 0. The explicit rotation wins the calculation, but the code either returns the original bounds or spreads them without replacing the old field. The visual bounds and frame consumers still see the old turn.
- **G2.** Test a rectangular marquee whose right edge exactly touches the left edge of a rectangular outline in `intersect` mode. The documented test takes an outline meeting the region anywhere. The early `>=` comparison rejects the candidate before it can evaluate the touching outline. The same cutoff excludes a zero-width outline lying along a selection boundary.
- **G3.** Union two individually finite boxes near x = `-1e308` and x = `1e308`. Both pass the corner checks, but the final width subtraction overflows. The result is unsuitable as a fit or viewport bound. `unionBounds` and `unionAabb` both use the same unchecked final extent arithmetic.

Source and tests were left untouched.
