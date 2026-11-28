# Review saturation for `renderer.gpu.webgpu`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 37 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Pass suspension and error recovery | 1 | 1 | 0 |
| 2 | WGSL entry reflection and vertex layout | 1 | 2 | 0 |
| 3 | Texture sampling, resource retirement and uploads | 0 | 2 | 1 |
| 4 | Readback, clipping, canvas configuration and device loss | 0 | 2 | 2 |
| 5 | Shader paint, ID outputs, uniform packing and pipeline keys | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An encoding exception leaves an ended render pass installed

[wgpuFrame.ts](packages/renderer/src/gpu/webgpu/wgpuFrame.ts#L113) · Pass 1 · Medium · Source-traced

outsidePass ends the active encoder pass and invokes the callback while Frame.pass still references that ended pass. A synchronous exception skips resume. Subsequent cleanup through end or flush can end the same encoder pass a second time, compounding the original failure and invalidating the pending submission.

### 2. A vertex attribute alias can override a real shader input name

[wgslEntries.ts](packages/renderer/src/gpu/webgpu/wgslEntries.ts#L70) · Pass 2 · Low · Source-traced

An unprefixed vertex input always installs an a_-prefixed alias. When both position and a_position exist at different locations, reversing their declaration order changes the location returned for a_position. Quad binding can consequently feed position data to the wrong input.

Source and tests were left untouched.
