# Review saturation for `renderer.part1`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 38 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Image loading state and retry paths | 1 | 1 | 0 |
| 2 | Renderer failure cleanup and offscreen pool ownership | 1 | 2 | 0 |
| 3 | Batch clipping, bounds and draw-stream accounting | 0 | 2 | 1 |
| 4 | Mesh paint baking, patch geometry, cache and editor handles | 0 | 2 | 2 |
| 5 | Effects compositing, context loss, glyph placement and marker commands | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A synchronous custom image loader failure leaves its entry pending indefinitely

[imageCache.ts](packages/renderer/src/images/imageCache.ts#L158) · Pass 1 · Medium · Source-traced

The cache commits its loading state before calling the installed loader. A synchronous throw bypasses both promise handlers, so imagePending stays true, imageLoadsSettled has no promise to wait for, and retryImage skips the entry. The same invocation pattern leaves the vector reraster pending flag stuck when a sizing load throws.

### 2. Failed picking frames strand borrowed effect targets across later picking frames

[WeaselRenderer.ts](packages/renderer/src/WeaselRenderer.ts#L289) · Pass 2 · Medium · Source-traced

If a child or effect throws after an isolated group has borrowed a target, the ID frame releases only its root target. The pool's reclaim step runs in render(), and is absent from the ID frame path. Repeated failed renderIds or renderIdsAsync calls between color frames therefore allocate more targets instead of recovering the earlier ones.

Source and tests were left untouched.
