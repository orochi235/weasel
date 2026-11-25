# Review saturation for `geom.paths.part1`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 38 files in the [Skulkr partition](docs/audits/partition.json#L3626), which was modified in the working tree. The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Anchor indexing, mutation and selection | 1 | 1 | 0 |
| 2 | Symmetry detection and contour traversal | 1 | 2 | 0 |
| 3 | Public path construction and loop bounds | 1 | 3 | 0 |
| 4 | Corner resolution, carry, restoration and offsets | 0 | 3 | 1 |
| 5 | Segment bending, path bending, drape and brush edits | 0 | 3 | 2 |
| 6 | Curve extrema, bounds, handle fits and contour reconstruction | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Finding | Location | First | Severity | Evidence |
|---|---|---|---:|---|---|
| P1 | A fractional anchor index can delete a real anchor | [anchorEdits.ts](packages/geom/src/paths/anchorEdits.ts#L51) | 1 | Medium | Executed |
| P2 | Symmetry detection can match the anchor set of a path whose edges are asymmetric | [anchorSymmetry.ts](packages/geom/src/paths/anchorSymmetry.ts#L49) | 2 | Medium | Source-traced |
| P3 | A non-finite regular polygon count can keep allocating vertices without a finite stop | [builder.ts](packages/geom/src/paths/builder.ts#L254) | 3 | Medium | Source-traced |

- **P1.** Delete index 1.5 from an open path with anchor x coordinates `[0,1,2,3]`. The operation returns true and removes anchor 1. The index walker accepts the fractional number and `splice` truncates it, so the edit deletes an anchor the caller did not identify.
- **P2.** Consider the open line run `(0,1) → (1,0) → (-1,0)`. Reflection across x=0 pairs all three anchors, so the detector accepts it. The reflected diagonal is absent from the original path. Pairing checks coordinates and handles but does not check adjacency or endpoints, so the result can claim a shape symmetry for a path that lacks it.
- **P3.** Passing positive infinity as the public `sides` count leaves the vertex loop without a finite endpoint. A star uses the same unchecked count pattern for its alternating vertices. A geometric constructor should reject such a count or return promptly.

Source and tests were left untouched.
