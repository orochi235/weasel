# Review saturation for `geom.paths.part2`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 38 files in the [Skulkr partition](docs/audits/partition.json#L3669), which was modified in the working tree. The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Transformation, local origins and degenerate extents | 1 | 1 | 0 |
| 2 | Subpath splitting, command streams and large inputs | 1 | 2 | 0 |
| 3 | Path data parsing, output and winding | 0 | 2 | 1 |
| 4 | Measuring, nearest placement, repetition and length-based edits | 0 | 2 | 2 |
| 5 | Resampling, fitting, simplification and shape interpolation | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Finding | Location | First | Severity | Evidence |
|---|---|---|---:|---|---|
| R1 | The identity affine can erase the width of a valid rect | [transformPath.ts](packages/geom/src/paths/transformPath.ts#L23) | 1 | Low | Executed |
| R2 | Splitting a large implicit subpath can throw an argument-limit exception | [splitSubpaths.ts](packages/geom/src/paths/splitSubpaths.ts#L35) | 2 | Medium | Executed |

- **R1.** Apply the identity matrix to `{kind:'rect', x:2**54, y:0, width:1, height:1}`. The output width is 0. The fast path adds width to the translated coordinate before taking the difference. The input width is stored separately and could survive directly applying the scale magnitude.
- **R2.** Feed `placeSubpaths` a command stream starting with `M Z` followed by 150,000 `L` commands. The first drawing command after close opens an implicit subpath. Prefixing its synthesized move spreads the entire command and coordinate streams into constructor calls, which exceed the engine's argument limit. This path can be represented by the typed buffers and the other splitting branch slices those buffers successfully.

The probes bundled production modules in memory. Source and tests were left untouched.
