# Review saturation for `renderer.draw`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 35 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Gradient and pattern math across batch and direct shaders | 1 | 1 | 0 |
| 2 | GPU geometry ownership and renderer teardown | 1 | 2 | 0 |
| 3 | Offscreen pass transitions, retained-surface recovery and effect target reclamation | 0 | 2 | 1 |
| 4 | Clip stacks, stencil masks, triangle cuts and stroke alignment | 0 | 2 | 2 |
| 5 | Picking, image sampling, glyph routing and custom uniform dispatch | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Short linear gradients change appearance between batch and direct draws

[gradient.ts](packages/renderer/src/draw/gradient.ts#L93) · Pass 1 · Medium · Source-traced

The batch path divides by the squared gradient length. The direct GLSL and WGSL shaders divide by the unit-direction length times max(length, 0.0001). With a positive length below that floor, the batch reaches the final stop earlier, so switching a path between batched and direct drawing changes the rendered gradient.

### 2. Quad layouts are left allocated when the renderer is disposed

[quad.ts](packages/renderer/src/draw/quad.ts#L23) · Pass 2 · Low · Source-traced

Each shader attribute layout creates a VAO through the WebGL backend. Renderer resource disposal deletes the quad buffers but has no path to the cached geometry handles and never calls deleteGeometry on them. The VAOs and their buffer references can remain until collection on a context that survives renderer disposal.

Source and tests were left untouched.
