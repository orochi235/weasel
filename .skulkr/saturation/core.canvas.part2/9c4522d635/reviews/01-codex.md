# Review saturation for `core.canvas.part2`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 39 files listed for the area in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Requirement parsing and version-range ambiguity | 1 | 1 | 0 |
| 2 | Raster dimensions and finite arithmetic | 1 | 2 | 0 |
| 3 | Pixel picking, spatial broad phase, planes and clips | 0 | 2 | 1 |
| 4 | Painter registration, layers, LOD and mount ownership | 0 | 2 | 2 |
| 5 | Paste placement, overlays and sampling readbacks | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| P1 | A numeric component after a wildcard is silently ignored in contribution requirements | [kitRequirements.ts](packages/core/src/canvas/kitRequirements.ts#L68) | 1 | Low | Source-traced |
| P2 | Validated raster inputs can produce infinite or unusable output dimensions | [pixelRenderRect.ts](packages/core/src/canvas/pixelRenderRect.ts#L28) | 2 | Medium | Source-traced |

- **P1.** A contribution declaring `core: '1.x.7'` passes the requirement check at 1.8.0 because the numeric suffix after the first wildcard is dropped. A wildcard should cover the remaining components, so a contradictory suffix should be rejected as an unreadable range instead of licensing an unintended interval.
- **P2.** A finite source width and finite, nonzero scale can each pass validation while their product is infinite. For example, width `1e308` and scale 10 reach the session as an infinite target width. Much smaller products beyond the platform limit are also accepted. The pixel dimensions should be checked before canvas sizing or buffer allocation, with an error about the computed dimensions. [Sizing caller](packages/core/src/canvas/renderSceneToPixels.ts#L55)

Source and tests were left untouched.
