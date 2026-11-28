# Review saturation for `renderer.cache`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 11 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Texture registration and page ownership | 1 | 1 | 0 |
| 2 | Image cache disposal and GPU mesh replacement | 2 | 3 | 0 |
| 3 | Marker and stroke geometry cache identity | 0 | 3 | 1 |
| 4 | Atlas row identity, eviction and sampling coordinates | 0 | 3 | 2 |
| 5 | Fill and outline default-rule invalidation, cache bounds and fallback texels | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Failed page allocation leaves a phantom page claim

[GLTextureCache.ts](packages/renderer/src/cache/GLTextureCache.ts#L146) · Pass 1 · Low · Source-traced

The page ID enters `pages` before either upload allocates a texture. If allocation throws, regular uploads under the ID still return early as collisions, leaving later `texture(id)` calls with no texture to bind.

### 2. Reused image cache stays absent from global image tracking

[GLImageCache.ts](packages/renderer/src/cache/GLImageCache.ts#L156) · Pass 2 · Low · Source-traced

Disposal removes the instance from `live`. Upload after disposal creates a fresh texture, a path covered by the cache test, but never restores membership. `releaseImageSource` cannot release the new texture and the global latest-frame query misses its draws.

### 3. Failed attribute replacement leaves an expiring mesh handle cached

[GLMeshCache.ts](packages/renderer/src/cache/GLMeshCache.ts#L77) · Pass 2 · Low · Source-traced

Attribute replacement queues the previous resources for transient cleanup before allocating the replacement. If allocation throws, the previous map entry survives. After `freeTransient`, a request matching the previous attribute returns the handle backed by deleted resources.

Source and tests were left untouched.
