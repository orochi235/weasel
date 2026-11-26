## A ramp whose bake throws on a full atlas leaves two stop lists naming one row
- where: packages/renderer/src/cache/GradientRampAtlas.ts:128 (upload / claimRow)
- scenario: the atlas is at `RAMP_ATLAS_MAX_ROWS` (an animating gradient fills it, as the header says it will). `upload` is then called with a stop whose color `parseColor` rejects (a half-typed `#ff`, a misspelled name), via `buildGradientRamp` → `resolveGradientStops` → `parseColor`, which throws. `claimRow` has already deleted the least recently used key from `rowByKey`, and `rowByKey.set` is never reached, so `rowByKey.size` is now `rows - 1`. The next new stop list takes `claimRow`'s free-row branch and is handed `rowByKey.size` = row 1023, which still belongs to a live key (unless the evicted row happened to be 1023). Both keys then name row 1023: the new ramp's texels overwrite it, and every later draw of the older gradient samples the new one's colors until that key is recycled. The free-row count also stays one short for good, so `wouldReshape` answers `false` for that upload though it rewrites a row a caller may hold. Should: bake before claiming a row (or restore the evicted key on a throw), so a failed upload leaves the map unchanged.
- evidence: read (claimRow at :193–202, upload at :117–132, `resolveGradientStops` calling the throwing `parseColor` in packages/paint/src/gradient.ts:34 and color.ts:31)
- severity: medium

## Files read
packages/renderer/src/cache/GLImageCache.ts
packages/renderer/src/cache/GLMeshCache.ts
packages/renderer/src/cache/GLTextureCache.ts
packages/renderer/src/cache/GradientRampAtlas.ts
packages/renderer/src/cache/cache.ts
packages/renderer/src/cache/markerCommandCache.ts
packages/renderer/src/cache/outlineMeshCache.ts
packages/renderer/src/cache/outlineStrokeMeshCache.ts
packages/renderer/src/cache/strokeMeshCache.ts
packages/renderer/src/cache/uploadPremultiplied.ts
packages/renderer/src/cache/whiteTexture.ts

<!-- done: 1 findings, files read: 11 -->
