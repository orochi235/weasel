# renderer.cache — round 89 findings

## GLTextureCache: an id made by uploadR8/uploadRGBA has no source or premultiply record, so a later upload under it rewrites the texture with no collision warning
- where: packages/renderer/src/cache/GLTextureCache.ts:135 (uploadR8), :149 (uploadRGBA), :67 (ensure)
- scenario: a glyph page is created with `uploadR8(id, …)` (or `uploadRGBA`), which sets only `map` and `wraps`. A later `upload(id, image)` or `uploadRegistered(id, image)` under the same id hits `ensure`'s cached branch: `premultiplied.get(id)` is `undefined`, so the `texture-alpha` collision warning is skipped, and `rewrites` is true (`sources.get(id)` is undefined), so `writeTexture` pours an RGBA image into the R8 (or color-glyph) texture and the glyph page is silently destroyed. The two other id collisions this class can see (font atlas vs registered texture) warn; this one should too, or the R8/RGBA paths should record what they wrote so `ensure` can tell.
- evidence: read
- severity: low

## GLTextureCache.sweep only runs on a registry version change, so a registered upload made after the frame's sweep for an id the registry no longer holds keeps its texture until some unrelated registration
- where: packages/renderer/src/cache/GLTextureCache.ts:91 (uploadRegistered), :111 (sweep)
- scenario: `patternBatch.stagePattern` uploads `paint.source` straight from the draw command (`packages/renderer/src/draw/patternBatch.ts:86`) without asking the registry. A command list built before `unregister(id)` and drawn after it (retained commands, a cached display list) calls `uploadRegistered(id, …)` after the top-of-frame `sweep` has already recorded the new version. The id is re-added to `registered` and a fresh texture created; every later `sweep` returns early on `version === sweptVersion`, so that texture is held until something else in the registry changes, which in a document that registers textures once may be never. The texture should be dropped by the next sweep regardless of version, e.g. by having `uploadRegistered` of an id the sweep has already passed mark the cache dirty.
- evidence: read (the stale-command path is inferred from patternBatch reading the source off the command rather than the registry)
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

<!-- done: 2 findings, files read: 11 -->
