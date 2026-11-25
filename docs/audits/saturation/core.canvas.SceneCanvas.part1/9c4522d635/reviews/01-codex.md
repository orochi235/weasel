# Review saturation for `core.canvas.SceneCanvas.part1`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 45 files listed for the area in the working-tree [Skulkr partition](docs/audits/partition.json). The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Preset relations, precedence and conflicting values | 1 | 1 | 0 |
| 2 | Picking through transformed copies and clip frames | 1 | 2 | 0 |
| 3 | Dispatcher publications, subscriptions and provider lifetimes | 0 | 2 | 1 |
| 4 | Layer defaults, prop passthrough and surface declarations | 0 | 2 | 2 |
| 5 | Built-in tools, gesture overlays, shape generators and frame hooks | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| S1 | A preset refinement cycle can crash key merging without identifying the invalid relation | [presetMerge.ts](packages/core/src/canvas/SceneCanvas/presetMerge.ts#L47) | 1 | Medium | Source-traced |
| S2 | An affine copy's pick tolerance uses a scalar and can miss visible ink | [scenePointQuery.ts](packages/core/src/canvas/SceneCanvas/scenePointQuery.ts#L54) | 2 | Medium | Source-traced |

- **S1.** Give presets A and B different values for the same layer key, with each naming the other in `refines`. The traversal terminates using its visited set and the conflict check sees a refinement in both directions. The winner search then finds no top provider and dereferences undefined. The resolver should reject the cyclic relation with the involved preset IDs. [Preset resolver](packages/core/src/canvas/SceneCanvas/features.ts#L249)
- **S2.** A group can return a copy matrix that scales x by 4 and y by 0.25. Its inverse has determinant 1, so the copied point query uses unchanged per-axis scale. A horizontal edge in the copy that is visibly within a 4 px grab band can map to more than 4 source units away and be rejected. Copy picking needs the copy's full linear frame when measuring a screen distance. [Copy traversal](packages/core/src/canvas/pickWalk.ts#L201)

Source and tests were left untouched.
