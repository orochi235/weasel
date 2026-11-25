# Review saturation for `core.canvas.part1`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 39 files listed for this area in the working-tree [Skulkr partition](docs/audits/partition.json). The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Canvas renderer acquisition, fallback and context recovery | 1 | 1 | 0 |
| 2 | Raster export views, signed scales and source rectangles | 1 | 2 | 0 |
| 3 | Content bounds versus duplicated draw-tree children | 1 | 3 | 0 |
| 4 | Mounted canvas variants, ref publication and subscription lifecycles | 0 | 3 | 1 |
| 5 | Adapter picking, drawn envelopes and bounds | 0 | 3 | 2 |
| 6 | Ambient contributions, hover and overlay ties | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| R1 | An unavailable requested backend can block a different backend permanently on the same unopened canvas | [canvasRenderer.ts](packages/core/src/canvas/canvasRenderer.ts#L222) | 1 | Medium | Source-traced |
| R2 | Command rasterization generates negative source extents for a flipped view | [commandRasterizer.ts](packages/core/src/canvas/commandRasterizer.ts#L46) | 2 | Medium | Source-traced |
| R3 | Content framing can include copies of a group's own box that the renderer never draws | [contentBounds.ts](packages/core/src/canvas/contentBounds.ts#L32) | 3 | Medium | Source-traced |

- **R1.** Bind a new element with an explicit WebGPU request where device acquisition says unavailable. No GPU context was opened, but `refuse` records the element in a backend-independent weak set. Rebind that same element with WebGL2. The refusal short-circuits before trying WebGL2, although the canvas is still free to open it. [Bind guard](packages/core/src/canvas/canvasRenderer.ts#L272)
- **R2.** Supply a positive raster rectangle and a page view with y scale −1. The rasterizer preserves the negative y scale but divides the source height by it, making the height negative. The raster session supports signed scales with positive source extents and rejects this request. [Raster validation](packages/core/src/canvas/pixelRenderRect.ts#L8)
- **R3.** Give a drawable group a box and a copy translated by 1,000 units, with no children or children occupying only a small part of that box. The content-bound pass transforms the group's whole box through the copy. The draw tree copies only children, so zoom-to-fit and minimap framing can include the invisible translated group box. [Draw-tree copy traversal](packages/core/src/canvas/buildSceneTree.ts#L185)

Source and tests were left untouched.
