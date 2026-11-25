# Audit round 85 — renderer.cache findings

## A world-width glyph stroke thinner than half an em quantum vanishes, and its width snaps to an em quantum the zoom does not scale
- where: packages/renderer/src/cache/outlineStrokeMeshCache.ts:34 (quantizeEmWidth), with the guard at :53 (outlineStrokeMesh)
- scenario: a text node at fontSize 100 with a world-unit stroke of width 0.04 (0.0004 em). `quantizeEmWidth(0.0004)` rounds to 0 (the quantum is 1/1024 ≈ 0.00098 em), so `outlineStrokeMesh` returns `null` and no stroke draws. Zoomed 100×, that stroke should be 4 screen pixels wide. A stroke between quanta snaps too: 0.0014 em becomes 0.00098 em, 30% thinner. The quantum is fixed in em, while the header argues its error from "200px text"; at a 4000px-per-em zoom one quantum is about 4 screen pixels, so widths step visibly. The `{ px }` path (`quantizeStrokeScale`) bounds its error in screen pixels, but the world path does not. It should either bound the error relative to the width or screen scale, or at least never round a positive width to 0.
- evidence: read (quantizeEmWidth; caller packages/renderer/src/glyphOutlineMesh.ts:71 passes `quantizeEmWidth(width / glyph.scale)`)
- severity: medium

## The gradient ramp key collapses non-finite stop offsets, so different stop lists share one row
- where: packages/renderer/src/cache/GradientRampAtlas.ts:66 (rampKey)
- scenario: `JSON.stringify` writes `NaN`, `Infinity` and `-Infinity` all as `null`. `[{offset: 0.5, color: 'red'}, {offset: -Infinity, color: 'blue'}]` and `[{offset: 0.5, color: 'red'}, {offset: Infinity, color: 'blue'}]` get the same key. They resolve to different sorted lists, so `sampleResolvedStops` bakes different ramps, but whichever is uploaded first serves both. A computed offset (e.g. a division by a zero-length span in an animated gradient) produces exactly these values. The key should encode offsets with `String(offset)` or similar, so non-finite values stay distinct.
- evidence: read (rampKey; resolveGradientStops/sampleResolvedStops in packages/paint/src/gradient.ts treat the three values differently)
- severity: low

## GLImageCache drops `repetition` on a cache hit, while GLTextureCache re-applies wrap for the same situation
- where: packages/renderer/src/cache/GLImageCache.ts:141 (upload)
- scenario: `upload(key, src, 'repeat')` after `upload(key, src)` returns the existing texture with clamp wrapping, and vice versa. The new repetition is silently ignored, so a pattern tile drawn from a bitmap already drawn as an image samples clamped. `GLTextureCache.ensure` makes the opposite call for the same case ("the same registered image can be a clamped shader texture in one draw and a repeating pattern tile in the next") and re-applies the wrap. So one decision is answered two ways. Today's renderer callers (`draw/image.ts`) pass no repetition, so the parameter is effectively dead. It should be re-applied the way GLTextureCache does, or removed.
- evidence: read
- severity: low

## GLMeshCache.handleFor ignores `attribute` on a hit
- where: packages/renderer/src/cache/GLMeshCache.ts:72 (handleFor), reached through uploadRecurring at :101
- scenario: a mesh drawn once through `handleFor(mesh)` and later through `handleFor(mesh, { location, size, data })`, or with new attribute data, gets back the first handle, whose geometry lacks the attribute or holds the old data. The program then reads a disabled attribute as its default (0,0,0,1). The cache is keyed on the mesh alone, so the attribute is an option silently dropped on the hit path. The current caller (`draw/clippedTrim.ts:64`) always pairs `ribbon.mesh` with its own `ribbon.trim`, so this is latent there.
- evidence: read
- severity: low

## A GLImageCache never disposed is pinned forever by the module-level `live` set
- where: packages/renderer/src/cache/GLImageCache.ts:35 (live), :86 (constructor)
- scenario: a renderer dropped without `dispose()`, for example a canvas unmounted by a host that never calls it, leaves its GLImageCache in `live`. `live` strongly holds the cache, its `GpuDevice` (so the WebGL context) and every uploaded texture, and these are never collected. The cache also keeps answering `maxImageTextureSide` with that context's limit and `imageSourceInLatestFrame` with its last frame. A `WeakRef` set, or a `FinalizationRegistry` on the owning renderer, would bound it.
- evidence: read (only `dispose`/`abandon` remove an entry; callers in packages/renderer/src/contextResources.ts)
- severity: low

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

<!-- done: 5 findings, files read: 11 -->
