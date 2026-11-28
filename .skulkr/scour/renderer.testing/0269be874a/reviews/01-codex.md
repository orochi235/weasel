# Review saturation for `renderer.testing`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 12 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Parity readback comparison and dimension handling | 1 | 1 | 0 |
| 2 | Recorder binding and vertex upload classification | 1 | 2 | 0 |
| 3 | GPU doubles, error scopes and teardown | 0 | 2 | 1 |
| 4 | Trim comparison and stencil fixture assumptions | 0 | 2 | 2 |
| 5 | Test helper exports, ramp coordinates and own-draw paint setup | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Parity comparison can miss a truncated readback

[parityHarness.ts](packages/renderer/src/testing/parityHarness.ts#L228) · Pass 1 · Low · Source-traced

The comparison loops over the first buffer without requiring equal lengths. Missing bytes in the second buffer yield undefined and turn the channel delta and maximum into NaN. The mismatch count can still be zero when details about the invalid pixels are collected separately. A longer second buffer is ignored entirely.

### 2. Vertex upload tracking includes writes to unrelated buffer targets

[vertexUploads.ts](packages/renderer/src/testing/vertexUploads.ts#L68) · Pass 2 · Low · Source-traced

The tracker updates its bound handle only for ARRAY_BUFFER, but collects Float32Array writes from every bufferData or bufferSubData call. A float upload to another target is attributed to the previously bound vertex buffer or fails with a misleading missing-stride error.

Source and tests were left untouched.
