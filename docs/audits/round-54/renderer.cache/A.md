I couldn't write `.skulk/out/findings.md` because permission was denied, so here is the whole document instead.

## An aligned `{ px }` glyph-outline stroke drops its stroke metric, so its screen thickness varies by direction under any non-similarity map
- where: packages/renderer/src/cache/outlineStrokeMeshCache.ts:74 (outlineStrokeMesh)
- scenario: Text is drawn with outline glyphs and a stroke of `{ width: { px: 2 }, align: 'outside' }` (or `'inside'`), under a map that is not a similarity: synthetic-oblique `shear`, or a view or pose that scales x and y differently. `glyphOutlineMesh.ts:57-64` computes `space.metric` and passes it in, and the cache key includes `metricKey(metric)`. But only the `align === 'center'` branch hands `metric` to `tessellateStroke`. The aligned branch calls `strokeToPath(glyph, sized, { flattenTolerance })` with no `frame`, so the ribbon is built evenly in em space at the geometric-mean width `px / pxPerEm` and then stretched by the em-to-screen map. The glyph's horizontal and vertical strokes come out at different on-screen widths instead of 2 px each. A center-aligned stroke on the same text keeps 2 px in every direction, and so does an aligned `{ px }` stroke on a scene path (`pathPaint.ts:249`, which builds through `strokeMesh` with `spaces.ribbon`). The two paths answer the same question two different ways. Because the metric is in the key, each metric also caches its own copy of an identical mesh.
- evidence: read
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